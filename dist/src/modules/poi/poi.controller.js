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
Object.defineProperty(exports, "__esModule", { value: true });
exports.POIController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const poi_service_1 = require("./poi.service");
const overpass_service_1 = require("./overpass.service");
let POIController = class POIController {
    constructor(poiService, overpassService) {
        this.poiService = poiService;
        this.overpassService = overpassService;
    }
    async search(lat, lng, radius) {
        return this.poiService.searchNearby({ latitude: Number(lat), longitude: Number(lng) }, radius ? Number(radius) : undefined);
    }
    async getNearby(lat, lng, radius) {
        return this.poiService.searchNearby({ latitude: Number(lat), longitude: Number(lng) }, radius ? Number(radius) : undefined);
    }
    async getByBbox(minLat, maxLat, minLng, maxLng, categoriesStr, limit) {
        const categories = categoriesStr
            ? categoriesStr.split(',').map(c => c.trim())
            : [];
        return this.poiService.findInBbox({
            minLat: Number(minLat),
            maxLat: Number(maxLat),
            minLng: Number(minLng),
            maxLng: Number(maxLng),
        }, categories, limit ? Number(limit) : 200);
    }
    async getById(id) {
        return this.poiService.getById(id);
    }
    async importFromOSM(body) {
        const { lat, lng, radius = 5000, categories = ['museum', 'restaurant', 'cafe', 'park', 'viewpoint', 'historical'] } = body;
        const poiCategories = categories.map(c => c);
        const center = { latitude: lat, longitude: lng };
        const pois = await this.overpassService.findPOIsInRadius(center, radius, poiCategories);
        await this.poiService.savePOIs(pois);
        return {
            message: `Imported ${pois.length} POIs from OpenStreetMap`,
            count: pois.length,
            categories: categories
        };
    }
};
exports.POIController = POIController;
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({ summary: 'Search POI in area' }),
    (0, swagger_1.ApiQuery)({ name: 'lat', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'lng', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'radius', type: Number, required: false }),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('radius')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", Promise)
], POIController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('nearby'),
    (0, swagger_1.ApiOperation)({ summary: 'Get nearby POIs' }),
    (0, swagger_1.ApiQuery)({ name: 'lat', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'lng', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'radius', type: Number, required: false }),
    __param(0, (0, common_1.Query)('lat')),
    __param(1, (0, common_1.Query)('lng')),
    __param(2, (0, common_1.Query)('radius')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", Promise)
], POIController.prototype, "getNearby", null);
__decorate([
    (0, common_1.Get)('bbox'),
    (0, swagger_1.ApiOperation)({ summary: 'Get POIs in bounding box (visible map area)' }),
    (0, swagger_1.ApiQuery)({ name: 'minLat', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxLat', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'minLng', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'maxLng', type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'categories', type: String, required: false, description: 'Comma-separated list of categories' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', type: Number, required: false }),
    __param(0, (0, common_1.Query)('minLat')),
    __param(1, (0, common_1.Query)('maxLat')),
    __param(2, (0, common_1.Query)('minLng')),
    __param(3, (0, common_1.Query)('maxLng')),
    __param(4, (0, common_1.Query)('categories')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number, Number, String, Number]),
    __metadata("design:returntype", Promise)
], POIController.prototype, "getByBbox", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get POI by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], POIController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, swagger_1.ApiOperation)({ summary: 'Import POIs from OpenStreetMap for an area' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                lat: { type: 'number', example: 39.47 },
                lng: { type: 'number', example: -0.376 },
                radius: { type: 'number', example: 5000 },
                categories: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['museum', 'restaurant', 'cafe', 'park', 'viewpoint', 'historical']
                }
            },
            required: ['lat', 'lng']
        }
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], POIController.prototype, "importFromOSM", null);
exports.POIController = POIController = __decorate([
    (0, swagger_1.ApiTags)('POI'),
    (0, common_1.Controller)('api/poi'),
    __metadata("design:paramtypes", [poi_service_1.POIService,
        overpass_service_1.OverpassService])
], POIController);
//# sourceMappingURL=poi.controller.js.map