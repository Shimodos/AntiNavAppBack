"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OverpassService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverpassService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const _shared_1 = require("../../../shared");
const constants_1 = require("../../../shared/constants");
const uuid_1 = require("uuid");
let OverpassService = OverpassService_1 = class OverpassService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(OverpassService_1.name);
        this.baseUrl = this.configService.get('overpass.url') ?? 'https://overpass-api.de/api/interpreter';
        this.fallbackUrls = this.configService.get('overpass.fallbackUrls') ?? [];
        this.timeout = this.configService.get('overpass.timeout') ?? 30000;
        this.retryAttempts = this.configService.get('overpass.retryAttempts') ?? 2;
        this.retryDelay = this.configService.get('overpass.retryDelay') ?? 1000;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async findPOIsInBoundingBox(bbox, categories) {
        const query = this.buildQuery(bbox, categories);
        const response = await this.executeQuery(query);
        return this.parseResponse(response, categories);
    }
    async findPOIsInRadius(center, radiusMeters, categories) {
        const query = this.buildRadiusQuery(center, radiusMeters, categories);
        const response = await this.executeQuery(query);
        return this.parseResponse(response, categories);
    }
    buildQuery(bbox, categories) {
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
    buildRadiusQuery(center, radius, categories) {
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
    buildTagQueries(categories, filter) {
        const queries = [];
        for (const category of categories) {
            const osmTags = constants_1.POI_CATEGORY_OSM_TAGS[category] || [];
            for (const tagSpec of osmTags) {
                const [key, value] = tagSpec.split('=');
                if (value === '*') {
                    queries.push(`node["${key}"]${filter};`);
                    queries.push(`way["${key}"]${filter};`);
                }
                else {
                    queries.push(`node["${key}"="${value}"]${filter};`);
                    queries.push(`way["${key}"="${value}"]${filter};`);
                }
            }
        }
        return queries.join('\n        ');
    }
    async executeQuery(query) {
        const urls = [this.baseUrl, ...this.fallbackUrls];
        let lastError = null;
        for (const url of urls) {
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    this.logger.debug(`Executing Overpass query on ${url} (attempt ${attempt}/${this.retryAttempts})`);
                    const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, `data=${encodeURIComponent(query)}`, {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Antinavigator/1.0',
                        },
                        timeout: this.timeout,
                    }));
                    this.logger.log(`Overpass query succeeded on ${url}`);
                    return response.data;
                }
                catch (error) {
                    this.logger.warn(`Overpass query failed on ${url} (attempt ${attempt}): ${error.message}`);
                    lastError = error;
                    if (attempt < this.retryAttempts) {
                        await this.delay(this.retryDelay * attempt);
                    }
                }
            }
        }
        this.logger.error(`All Overpass servers failed after retries`);
        throw lastError || new Error('All Overpass servers failed');
    }
    parseResponse(response, requestedCategories) {
        const pois = [];
        for (const element of response.elements) {
            const lat = element.lat ?? element.center?.lat;
            const lon = element.lon ?? element.center?.lon;
            if (!lat || !lon || !element.tags)
                continue;
            const category = this.detectCategory(element.tags, requestedCategories);
            if (!category)
                continue;
            const poi = {
                id: (0, uuid_1.v4)(),
                name: this.extractName(element.tags),
                description: element.tags.description,
                coordinates: { latitude: lat, longitude: lon },
                category,
                subcategory: this.extractSubcategory(element.tags),
                rating: undefined,
                ratingCount: 0,
                photos: this.extractPhotos(element.tags),
                openingHours: this.parseOpeningHours(element.tags.opening_hours),
                website: element.tags.website || element.tags['contact:website'],
                phone: element.tags.phone || element.tags['contact:phone'],
                address: this.extractAddress(element.tags),
                source: _shared_1.POISource.OSM,
                sourceId: `${element.type}/${element.id}`,
                tags: this.extractTags(element.tags),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            if (poi.name && poi.name !== 'Unnamed') {
                pois.push(poi);
            }
        }
        return pois;
    }
    detectCategory(tags, requestedCategories) {
        for (const category of requestedCategories) {
            const osmTags = constants_1.POI_CATEGORY_OSM_TAGS[category] || [];
            for (const tagSpec of osmTags) {
                const [key, value] = tagSpec.split('=');
                if (value === '*') {
                    if (tags[key])
                        return category;
                }
                else {
                    if (tags[key] === value)
                        return category;
                }
            }
        }
        return null;
    }
    extractName(tags) {
        return (tags['name:ru'] ||
            tags['name:en'] ||
            tags.name ||
            tags.operator ||
            tags.brand ||
            'Unnamed');
    }
    extractSubcategory(tags) {
        return (tags.cuisine ||
            tags.sport ||
            tags.religion ||
            tags.museum ||
            tags.artwork_type);
    }
    extractPhotos(tags) {
        const photos = [];
        if (tags.wikimedia_commons) {
            const filename = tags.wikimedia_commons.replace('File:', '');
            photos.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`);
        }
        if (tags.image) {
            photos.push(tags.image);
        }
        return photos;
    }
    parseOpeningHours(raw) {
        if (!raw)
            return undefined;
        return { raw };
    }
    extractAddress(tags) {
        const parts = [];
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
    extractTags(tags) {
        const relevantTags = [];
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
    async getPOIDetails(osmType, osmId) {
        const query = `
      [out:json];
      ${osmType}(${osmId});
      out body;
    `;
        try {
            const response = await this.executeQuery(query);
            return response.elements[0] || null;
        }
        catch (error) {
            this.logger.error(`Failed to get POI details: ${error.message}`);
            return null;
        }
    }
};
exports.OverpassService = OverpassService;
exports.OverpassService = OverpassService = OverpassService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], OverpassService);
//# sourceMappingURL=overpass.service.js.map