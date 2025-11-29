import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Coordinates, POI, POICategory, BoundingBox } from '@shared';
import { getBoundingBox, expandBoundingBox, encodeGeohash } from '@shared/utils/geo';
import { OverpassService } from './overpass.service';
import { POICacheService } from './poi-cache.service';
import { POIEntity } from './poi.entity';

@Injectable()
export class POIService {
  private readonly logger = new Logger(POIService.name);
  private readonly maxSearchRadius: number;
  private readonly defaultSearchRadius: number;

  constructor(
    @InjectRepository(POIEntity)
    private readonly poiRepository: Repository<POIEntity>,
    private readonly overpassService: OverpassService,
    private readonly cacheService: POICacheService,
    private readonly configService: ConfigService,
  ) {
    this.maxSearchRadius = this.configService.get<number>('poi.maxSearchRadius') ?? 50000;
    this.defaultSearchRadius = this.configService.get<number>('poi.defaultSearchRadius') ?? 5000;
  }

  async searchNearby(center: Coordinates, radius?: number): Promise<POI[]> {
    const searchRadius = radius ?? this.defaultSearchRadius;
    return this.findInRadius(center, searchRadius, [], 100);
  }

  async getById(id: string): Promise<POI | null> {
    return this.findById(id);
  }

  async findInRadius(
    center: Coordinates,
    radiusMeters: number,
    categories: POICategory[],
    limit: number = 100,
  ): Promise<POI[]> {
    const radius = Math.min(radiusMeters, this.maxSearchRadius);
    
    // Проверяем кэш
    const cacheKey = this.buildCacheKey(center, radius, categories);
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached) {
      this.logger.debug(`Cache hit for POI search: ${cacheKey}`);
      return cached.slice(0, limit);
    }

    // Сначала ищем в локальной базе
    const localPois = await this.findInRadiusFromDB(center, radius, categories, limit);
    
    // Если локальных POI мало, догружаем из Overpass
    // Временно отключено - используем только локальные POI
    if (false && localPois.length < limit * 0.5) {
      this.logger.debug('Fetching additional POIs from Overpass');
      const remotePois = await this.overpassService.findPOIsInRadius(
        center,
        radius,
        categories,
      );

      // Сохраняем новые POI в базу
      await this.savePOIs(remotePois);

      // Объединяем и дедуплицируем
      const allPois = this.mergePOIs(localPois, remotePois);
      
      // Кэшируем результат
      await this.cacheService.set(cacheKey, allPois);
      
      return allPois.slice(0, limit);
    }

    await this.cacheService.set(cacheKey, localPois);
    return localPois;
  }

  async findInPolygon(
    polygon: Coordinates[],
    categories: POICategory[],
    limit: number = 100,
  ): Promise<POI[]> {
    // Получаем bounding box полигона
    const bbox = getBoundingBox(polygon);
    
    // Расширяем немного для буфера
    const expandedBbox = expandBoundingBox(bbox, 100);

    // Ищем в базе с использованием PostGIS
    const localPois = await this.findInBboxFromDB(expandedBbox, categories, limit);

    // Если мало результатов, догружаем из Overpass
    if (localPois.length < limit * 0.3) {
      const remotePois = await this.overpassService.findPOIsInBoundingBox(
        expandedBbox,
        categories,
      );

      await this.savePOIs(remotePois);
      
      const allPois = this.mergePOIs(localPois, remotePois);
      
      // Фильтруем по полигону (точнее чем bbox)
      const filteredPois = this.filterByPolygon(allPois, polygon);
      
      return filteredPois.slice(0, limit);
    }

    return this.filterByPolygon(localPois, polygon).slice(0, limit);
  }

  async findById(id: string): Promise<POI | null> {
    const entity = await this.poiRepository.findOne({ where: { id } });
    return entity ? this.entityToPOI(entity) : null;
  }

  async findBySourceId(source: string, sourceId: string): Promise<POI | null> {
    const entity = await this.poiRepository.findOne({
      where: { source, externalId: sourceId },
    });
    return entity ? this.entityToPOI(entity) : null;
  }

  async search(
    query: string,
    center?: Coordinates,
    radiusMeters?: number,
    categories?: POICategory[],
    limit: number = 20,
  ): Promise<POI[]> {
    let qb = this.poiRepository
      .createQueryBuilder('poi')
      .where('poi.name ILIKE :query', { query: `%${query}%` });

    if (categories && categories.length > 0) {
      qb = qb.andWhere('poi.category IN (:...categories)', { categories });
    }

    if (center && radiusMeters) {
      qb = qb.andWhere(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
        {
          lat: center.latitude,
          lng: center.longitude,
          radius: radiusMeters,
        },
      );

      // Сортируем по расстоянию
      qb = qb.orderBy(
        `ST_Distance(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        'ASC',
      );
    }

    qb = qb.limit(limit);

    const entities = await qb.getMany();
    return entities.map((e) => this.entityToPOI(e));
  }

  private async findInRadiusFromDB(
    center: Coordinates,
    radius: number,
    categories: POICategory[],
    limit: number,
  ): Promise<POI[]> {
    // Используем ST_DWithin с построением точки на лету из latitude/longitude
    let qb = this.poiRepository
      .createQueryBuilder('poi')
      .where(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
        {
          lat: center.latitude,
          lng: center.longitude,
          radius,
        },
      );

    if (categories.length > 0) {
      qb = qb.andWhere('poi.category IN (:...categories)', { categories });
    }

    qb = qb
      .orderBy(
        `ST_Distance(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        'ASC',
      )
      .limit(limit);

    const entities = await qb.getMany();
    return entities.map((e) => this.entityToPOI(e));
  }

  private async findInBboxFromDB(
    bbox: BoundingBox,
    categories: POICategory[],
    limit: number,
  ): Promise<POI[]> {
    // Используем простые сравнения координат для bbox
    let qb = this.poiRepository
      .createQueryBuilder('poi')
      .where('poi.latitude >= :minLat AND poi.latitude <= :maxLat', {
        minLat: bbox.minLat,
        maxLat: bbox.maxLat,
      })
      .andWhere('poi.longitude >= :minLng AND poi.longitude <= :maxLng', {
        minLng: bbox.minLng,
        maxLng: bbox.maxLng,
      });

    if (categories.length > 0) {
      qb = qb.andWhere('poi.category IN (:...categories)', { categories });
    }

    qb = qb.orderBy('poi.rating', 'DESC', 'NULLS LAST').limit(limit);

    const entities = await qb.getMany();
    return entities.map((e) => this.entityToPOI(e));
  }

  async findInBbox(
    bbox: BoundingBox,
    categories: POICategory[],
    limit: number = 200,
  ): Promise<POI[]> {
    return this.findInBboxFromDB(bbox, categories, limit);
  }

  async savePOIs(pois: POI[]): Promise<void> {
    const entities = pois.map((poi) => this.poiToEntity(poi));

    // Upsert: обновляем если уже есть
    await this.poiRepository
      .createQueryBuilder()
      .insert()
      .into(POIEntity)
      .values(entities)
      .orUpdate(['name', 'description', 'rating', 'opening_hours', 'updated_at'], [
        'source',
        'external_id',
      ])
      .execute();
  }

  private mergePOIs(local: POI[], remote: POI[]): POI[] {
    const seen = new Set<string>();
    const result: POI[] = [];

    // Сначала добавляем локальные (они приоритетнее)
    for (const poi of local) {
      const key = `${poi.source}:${poi.sourceId}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(poi);
      }
    }

    // Потом добавляем удалённые, если нет дубликатов
    for (const poi of remote) {
      const key = `${poi.source}:${poi.sourceId}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(poi);
      }
    }

    return result;
  }

  private filterByPolygon(pois: POI[], polygon: Coordinates[]): POI[] {
    // Простая проверка point-in-polygon
    return pois.filter((poi) => this.isPointInPolygon(poi.coordinates, polygon));
  }

  private isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
    let inside = false;
    const x = point.longitude;
    const y = point.latitude;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].longitude;
      const yi = polygon[i].latitude;
      const xj = polygon[j].longitude;
      const yj = polygon[j].latitude;

      if (
        ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  private buildCacheKey(
    center: Coordinates,
    radius: number,
    categories: POICategory[],
  ): string {
    const geohash = encodeGeohash(center, 5);
    const radiusBucket = Math.ceil(radius / 1000) * 1000; // Округляем до км
    const categoriesKey = categories.sort().join(',');
    return `poi:${geohash}:${radiusBucket}:${categoriesKey}`;
  }

  private entityToPOI(entity: POIEntity): POI {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      coordinates: {
        latitude: entity.latitude,
        longitude: entity.longitude,
      },
      category: entity.category as POICategory,
      subcategory: entity.subcategory,
      rating: entity.rating ? parseFloat(entity.rating.toString()) : undefined,
      ratingCount: entity.ratingCount,
      photos: entity.photos,
      openingHours: entity.openingHours,
      website: entity.website,
      phone: entity.phone,
      address: entity.address,
      source: entity.source as any,
      sourceId: entity.externalId,
      tags: entity.tags,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private poiToEntity(poi: POI): Partial<POIEntity> {
    return {
      id: poi.id,
      externalId: poi.sourceId,
      source: poi.source,
      name: poi.name,
      description: poi.description,
      latitude: poi.coordinates.latitude,
      longitude: poi.coordinates.longitude,
      category: poi.category,
      subcategory: poi.subcategory,
      rating: poi.rating,
      ratingCount: poi.ratingCount,
      photos: poi.photos,
      openingHours: poi.openingHours,
      website: poi.website,
      phone: poi.phone,
      address: poi.address,
      tags: poi.tags,
    };
  }
}
