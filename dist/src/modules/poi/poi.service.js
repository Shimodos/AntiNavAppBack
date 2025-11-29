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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var POIService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.POIService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const geo_1 = require("../../../shared/utils/geo");
const overpass_service_1 = require("./overpass.service");
const poi_cache_service_1 = require("./poi-cache.service");
const poi_entity_1 = require("./poi.entity");
let POIService = POIService_1 = class POIService {
    constructor(poiRepository, overpassService, cacheService, configService) {
        this.poiRepository = poiRepository;
        this.overpassService = overpassService;
        this.cacheService = cacheService;
        this.configService = configService;
        this.logger = new common_1.Logger(POIService_1.name);
        this.maxSearchRadius = this.configService.get('poi.maxSearchRadius') ?? 50000;
        this.defaultSearchRadius = this.configService.get('poi.defaultSearchRadius') ?? 5000;
    }
    async searchNearby(center, radius) {
        const searchRadius = radius ?? this.defaultSearchRadius;
        return this.findInRadius(center, searchRadius, [], 100);
    }
    async getById(id) {
        return this.findById(id);
    }
    async findInRadius(center, radiusMeters, categories, limit = 100) {
        const radius = Math.min(radiusMeters, this.maxSearchRadius);
        const cacheKey = this.buildCacheKey(center, radius, categories);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            this.logger.debug(`Cache hit for POI search: ${cacheKey}`);
            return cached.slice(0, limit);
        }
        const localPois = await this.findInRadiusFromDB(center, radius, categories, limit);
        if (false && localPois.length < limit * 0.5) {
            this.logger.debug('Fetching additional POIs from Overpass');
            const remotePois = await this.overpassService.findPOIsInRadius(center, radius, categories);
            await this.savePOIs(remotePois);
            const allPois = this.mergePOIs(localPois, remotePois);
            await this.cacheService.set(cacheKey, allPois);
            return allPois.slice(0, limit);
        }
        await this.cacheService.set(cacheKey, localPois);
        return localPois;
    }
    async findInPolygon(polygon, categories, limit = 100) {
        const bbox = (0, geo_1.getBoundingBox)(polygon);
        const expandedBbox = (0, geo_1.expandBoundingBox)(bbox, 100);
        const localPois = await this.findInBboxFromDB(expandedBbox, categories, limit);
        if (localPois.length < limit * 0.3) {
            const remotePois = await this.overpassService.findPOIsInBoundingBox(expandedBbox, categories);
            await this.savePOIs(remotePois);
            const allPois = this.mergePOIs(localPois, remotePois);
            const filteredPois = this.filterByPolygon(allPois, polygon);
            return filteredPois.slice(0, limit);
        }
        return this.filterByPolygon(localPois, polygon).slice(0, limit);
    }
    async findById(id) {
        const entity = await this.poiRepository.findOne({ where: { id } });
        return entity ? this.entityToPOI(entity) : null;
    }
    async findBySourceId(source, sourceId) {
        const entity = await this.poiRepository.findOne({
            where: { source, externalId: sourceId },
        });
        return entity ? this.entityToPOI(entity) : null;
    }
    async search(query, center, radiusMeters, categories, limit = 20) {
        let qb = this.poiRepository
            .createQueryBuilder('poi')
            .where('poi.name ILIKE :query', { query: `%${query}%` });
        if (categories && categories.length > 0) {
            qb = qb.andWhere('poi.category IN (:...categories)', { categories });
        }
        if (center && radiusMeters) {
            qb = qb.andWhere(`ST_DWithin(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`, {
                lat: center.latitude,
                lng: center.longitude,
                radius: radiusMeters,
            });
            qb = qb.orderBy(`ST_Distance(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`, 'ASC');
        }
        qb = qb.limit(limit);
        const entities = await qb.getMany();
        return entities.map((e) => this.entityToPOI(e));
    }
    async findInRadiusFromDB(center, radius, categories, limit) {
        let qb = this.poiRepository
            .createQueryBuilder('poi')
            .where(`ST_DWithin(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`, {
            lat: center.latitude,
            lng: center.longitude,
            radius,
        });
        if (categories.length > 0) {
            qb = qb.andWhere('poi.category IN (:...categories)', { categories });
        }
        qb = qb
            .orderBy(`ST_Distance(
          ST_SetSRID(ST_MakePoint(poi.longitude, poi.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`, 'ASC')
            .limit(limit);
        const entities = await qb.getMany();
        return entities.map((e) => this.entityToPOI(e));
    }
    async findInBboxFromDB(bbox, categories, limit) {
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
    async findInBbox(bbox, categories, limit = 200) {
        return this.findInBboxFromDB(bbox, categories, limit);
    }
    async savePOIs(pois) {
        const entities = pois.map((poi) => this.poiToEntity(poi));
        await this.poiRepository
            .createQueryBuilder()
            .insert()
            .into(poi_entity_1.POIEntity)
            .values(entities)
            .orUpdate(['name', 'description', 'rating', 'opening_hours', 'updated_at'], [
            'source',
            'external_id',
        ])
            .execute();
    }
    mergePOIs(local, remote) {
        const seen = new Set();
        const result = [];
        for (const poi of local) {
            const key = `${poi.source}:${poi.sourceId}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(poi);
            }
        }
        for (const poi of remote) {
            const key = `${poi.source}:${poi.sourceId}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(poi);
            }
        }
        return result;
    }
    filterByPolygon(pois, polygon) {
        return pois.filter((poi) => this.isPointInPolygon(poi.coordinates, polygon));
    }
    isPointInPolygon(point, polygon) {
        let inside = false;
        const x = point.longitude;
        const y = point.latitude;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].longitude;
            const yi = polygon[i].latitude;
            const xj = polygon[j].longitude;
            const yj = polygon[j].latitude;
            if (((yi > y) !== (yj > y)) &&
                (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }
    buildCacheKey(center, radius, categories) {
        const geohash = (0, geo_1.encodeGeohash)(center, 5);
        const radiusBucket = Math.ceil(radius / 1000) * 1000;
        const categoriesKey = categories.sort().join(',');
        return `poi:${geohash}:${radiusBucket}:${categoriesKey}`;
    }
    entityToPOI(entity) {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            coordinates: {
                latitude: entity.latitude,
                longitude: entity.longitude,
            },
            category: entity.category,
            subcategory: entity.subcategory,
            rating: entity.rating ? parseFloat(entity.rating.toString()) : undefined,
            ratingCount: entity.ratingCount,
            photos: entity.photos,
            openingHours: entity.openingHours,
            website: entity.website,
            phone: entity.phone,
            address: entity.address,
            source: entity.source,
            sourceId: entity.externalId,
            tags: entity.tags,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
    poiToEntity(poi) {
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
};
exports.POIService = POIService;
exports.POIService = POIService = POIService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(poi_entity_1.POIEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        overpass_service_1.OverpassService,
        poi_cache_service_1.POICacheService,
        config_1.ConfigService])
], POIService);
//# sourceMappingURL=poi.service.js.map