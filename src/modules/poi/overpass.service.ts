import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Coordinates, POI, POICategory, POISource, BoundingBox } from '@shared';
import { POI_CATEGORY_OSM_TAGS } from '@shared/constants';
import { v4 as uuidv4 } from 'uuid';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

@Injectable()
export class OverpassService {
  private readonly logger = new Logger(OverpassService.name);
  private readonly baseUrl: string;
  private readonly fallbackUrls: string[];
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('overpass.url') ?? 'https://overpass-api.de/api/interpreter';
    this.fallbackUrls = this.configService.get<string[]>('overpass.fallbackUrls') ?? [];
    this.timeout = this.configService.get<number>('overpass.timeout') ?? 30000;
    this.retryAttempts = this.configService.get<number>('overpass.retryAttempts') ?? 2;
    this.retryDelay = this.configService.get<number>('overpass.retryDelay') ?? 1000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async findPOIsInBoundingBox(
    bbox: BoundingBox,
    categories: POICategory[],
  ): Promise<POI[]> {
    const query = this.buildQuery(bbox, categories);
    const response = await this.executeQuery(query);
    return this.parseResponse(response, categories);
  }

  async findPOIsInRadius(
    center: Coordinates,
    radiusMeters: number,
    categories: POICategory[],
  ): Promise<POI[]> {
    const query = this.buildRadiusQuery(center, radiusMeters, categories);
    const response = await this.executeQuery(query);
    return this.parseResponse(response, categories);
  }

  private buildQuery(bbox: BoundingBox, categories: POICategory[]): string {
    const bboxStr = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
    const tagQueries = this.buildTagQueries(categories, `(${bboxStr})`);

    return `
      [out:json][timeout:${Math.floor(this.timeout / 1000)}];
      (
        ${tagQueries}
      );
      out center;
    `;
  }

  private buildRadiusQuery(
    center: Coordinates,
    radius: number,
    categories: POICategory[],
  ): string {
    const aroundStr = `(around:${radius},${center.latitude},${center.longitude})`;
    const tagQueries = this.buildTagQueries(categories, aroundStr);

    return `
      [out:json][timeout:${Math.floor(this.timeout / 1000)}];
      (
        ${tagQueries}
      );
      out center;
    `;
  }

  private buildTagQueries(categories: POICategory[], filter: string): string {
    const queries: string[] = [];

    for (const category of categories) {
      const osmTags = POI_CATEGORY_OSM_TAGS[category] || [];
      
      for (const tagSpec of osmTags) {
        // tagSpec формат: "key=value" или "key=*"
        const [key, value] = tagSpec.split('=');
        
        if (value === '*') {
          queries.push(`node["${key}"]${filter};`);
          queries.push(`way["${key}"]${filter};`);
        } else {
          queries.push(`node["${key}"="${value}"]${filter};`);
          queries.push(`way["${key}"="${value}"]${filter};`);
        }
      }
    }

    return queries.join('\n        ');
  }

  private async executeQuery(query: string): Promise<OverpassResponse> {
    const urls = [this.baseUrl, ...this.fallbackUrls];
    let lastError: Error | null = null;

    for (const url of urls) {
      // Try each server with retries
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          this.logger.debug(`Executing Overpass query on ${url} (attempt ${attempt}/${this.retryAttempts})`);

          const response = await firstValueFrom(
            this.httpService.post<OverpassResponse>(
              url,
              `data=${encodeURIComponent(query)}`,
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'Antinavigator/1.0',
                },
                timeout: this.timeout,
              },
            ),
          );

          this.logger.log(`Overpass query succeeded on ${url}`);
          return response.data;
        } catch (error) {
          this.logger.warn(`Overpass query failed on ${url} (attempt ${attempt}): ${error.message}`);
          lastError = error;

          // Wait before retry (but not after last attempt)
          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * attempt); // Exponential backoff
          }
        }
      }
    }

    this.logger.error(`All Overpass servers failed after retries`);
    throw lastError || new Error('All Overpass servers failed');
  }

  private parseResponse(
    response: OverpassResponse,
    requestedCategories: POICategory[],
  ): POI[] {
    const pois: POI[] = [];

    for (const element of response.elements) {
      // Получаем координаты (для way используем center)
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;

      if (!lat || !lon || !element.tags) continue;

      // Определяем категорию
      const category = this.detectCategory(element.tags, requestedCategories);
      if (!category) continue;

      // Извлекаем данные
      const poi: POI = {
        id: uuidv4(),
        name: this.extractName(element.tags),
        description: element.tags.description,
        coordinates: { latitude: lat, longitude: lon },
        category,
        subcategory: this.extractSubcategory(element.tags),
        rating: undefined, // OSM не имеет рейтингов
        ratingCount: 0,
        photos: this.extractPhotos(element.tags),
        openingHours: this.parseOpeningHours(element.tags.opening_hours),
        website: element.tags.website || element.tags['contact:website'],
        phone: element.tags.phone || element.tags['contact:phone'],
        address: this.extractAddress(element.tags),
        source: POISource.OSM,
        sourceId: `${element.type}/${element.id}`,
        tags: this.extractTags(element.tags),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Пропускаем POI без имени (обычно это мусорные данные)
      if (poi.name && poi.name !== 'Unnamed') {
        pois.push(poi);
      }
    }

    return pois;
  }

  private detectCategory(
    tags: Record<string, string>,
    requestedCategories: POICategory[],
  ): POICategory | null {
    for (const category of requestedCategories) {
      const osmTags = POI_CATEGORY_OSM_TAGS[category] || [];
      
      for (const tagSpec of osmTags) {
        const [key, value] = tagSpec.split('=');
        
        if (value === '*') {
          if (tags[key]) return category;
        } else {
          if (tags[key] === value) return category;
        }
      }
    }

    return null;
  }

  private extractName(tags: Record<string, string>): string {
    // Приоритет имён: ru -> en -> name -> operator
    return (
      tags['name:ru'] ||
      tags['name:en'] ||
      tags.name ||
      tags.operator ||
      tags.brand ||
      'Unnamed'
    );
  }

  private extractSubcategory(tags: Record<string, string>): string | undefined {
    // Пытаемся извлечь подкатегорию из тегов
    return (
      tags.cuisine ||
      tags.sport ||
      tags.religion ||
      tags.museum ||
      tags.artwork_type
    );
  }

  private extractPhotos(tags: Record<string, string>): string[] {
    const photos: string[] = [];
    
    // Wikimedia Commons
    if (tags.wikimedia_commons) {
      // Формат: File:Example.jpg
      const filename = tags.wikimedia_commons.replace('File:', '');
      photos.push(
        `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`,
      );
    }

    // Wikipedia изображение
    if (tags.image) {
      photos.push(tags.image);
    }

    return photos;
  }

  private parseOpeningHours(raw?: string): any {
    if (!raw) return undefined;

    // OSM opening_hours формат сложный, пока сохраняем как есть
    // В production можно использовать библиотеку opening_hours
    return { raw };
  }

  private extractAddress(tags: Record<string, string>): string | undefined {
    const parts: string[] = [];

    if (tags['addr:street']) {
      let street = tags['addr:street'];
      if (tags['addr:housenumber']) {
        street += `, ${tags['addr:housenumber']}`;
      }
      parts.push(street);
    }

    if (tags['addr:city']) {
      parts.push(tags['addr:city']);
    }

    if (tags['addr:postcode']) {
      parts.push(tags['addr:postcode']);
    }

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private extractTags(tags: Record<string, string>): string[] {
    const relevantTags: string[] = [];
    const tagKeys = [
      'tourism',
      'amenity',
      'leisure',
      'historic',
      'natural',
      'shop',
      'sport',
      'cuisine',
      'wheelchair',
      'internet_access',
    ];

    for (const key of tagKeys) {
      if (tags[key]) {
        relevantTags.push(`${key}:${tags[key]}`);
      }
    }

    return relevantTags;
  }

  // Получение детальной информации о POI по OSM ID
  async getPOIDetails(osmType: string, osmId: number): Promise<OverpassElement | null> {
    const query = `
      [out:json];
      ${osmType}(${osmId});
      out body;
    `;

    try {
      const response = await this.executeQuery(query);
      return response.elements[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get POI details: ${error.message}`);
      return null;
    }
  }
}
