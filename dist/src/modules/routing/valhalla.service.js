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
var ValhallaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValhallaService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const _shared_1 = require("../../../shared");
let ValhallaService = ValhallaService_1 = class ValhallaService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(ValhallaService_1.name);
        this.baseUrl = this.configService.get('valhalla.url') ?? 'http://localhost:8002';
        this.timeout = this.configService.get('valhalla.timeout') ?? 30000;
    }
    getCostingProfile(mode) {
        const mapping = {
            [_shared_1.TransportMode.CAR]: 'auto',
            [_shared_1.TransportMode.BICYCLE]: 'bicycle',
            [_shared_1.TransportMode.PEDESTRIAN]: 'pedestrian',
        };
        return mapping[mode] || 'auto';
    }
    toValhallaLocation(coords, type = 'break') {
        return {
            lat: coords.latitude,
            lon: coords.longitude,
            type,
        };
    }
    async route(origin, destination, waypoints = [], mode = _shared_1.TransportMode.CAR, options) {
        const locations = [
            this.toValhallaLocation(origin, 'break'),
            ...waypoints.map((wp) => this.toValhallaLocation(wp, 'through')),
            this.toValhallaLocation(destination, 'break'),
        ];
        const costing = this.getCostingProfile(mode);
        const costingOptions = {};
        if (options?.avoidHighways && costing === 'auto') {
            costingOptions.auto = { use_highways: 0.0 };
        }
        if (options?.avoidTolls && costing === 'auto') {
            costingOptions.auto = {
                ...costingOptions.auto,
                use_tolls: 0.0,
            };
        }
        const request = {
            locations,
            costing,
            costing_options: Object.keys(costingOptions).length > 0 ? costingOptions : undefined,
            directions_options: {
                units: 'kilometers',
                language: 'ru-RU',
            },
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/route`, request, { timeout: this.timeout }));
            return response.data;
        }
        catch (error) {
            this.logger.error(`Valhalla route error: ${error.message}`, error.stack);
            throw error;
        }
    }
    async optimizedRoute(locations, mode = _shared_1.TransportMode.CAR) {
        const valhallaLocations = locations.map((loc) => this.toValhallaLocation(loc, 'break'));
        const request = {
            locations: valhallaLocations,
            costing: this.getCostingProfile(mode),
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/optimized_route`, request, { timeout: this.timeout }));
            return response.data;
        }
        catch (error) {
            this.logger.error(`Valhalla optimized route error: ${error.message}`, error.stack);
            throw error;
        }
    }
    async isochrone(location, mode, contours) {
        const request = {
            locations: [this.toValhallaLocation(location)],
            costing: this.getCostingProfile(mode),
            contours: contours.map((c) => ({
                time: c.timeMinutes,
                distance: c.distanceKm,
            })),
            polygons: true,
            denoise: 0.5,
            generalize: 50,
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/isochrone`, request, { timeout: this.timeout }));
            return response.data;
        }
        catch (error) {
            this.logger.error(`Valhalla isochrone error: ${error.message}`, error.stack);
            throw error;
        }
    }
    async matrix(sources, targets, mode = _shared_1.TransportMode.CAR) {
        const request = {
            sources: sources.map((s) => this.toValhallaLocation(s)),
            targets: targets.map((t) => this.toValhallaLocation(t)),
            costing: this.getCostingProfile(mode),
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/sources_to_targets`, request, { timeout: this.timeout }));
            const data = response.data;
            const distances = [];
            const durations = [];
            for (let i = 0; i < sources.length; i++) {
                distances[i] = [];
                durations[i] = [];
                for (let j = 0; j < targets.length; j++) {
                    const idx = i * targets.length + j;
                    distances[i][j] = data.sources_to_targets[idx]?.distance || Infinity;
                    durations[i][j] = data.sources_to_targets[idx]?.time || Infinity;
                }
            }
            return { distances, durations };
        }
        catch (error) {
            this.logger.error(`Valhalla matrix error: ${error.message}`, error.stack);
            throw error;
        }
    }
    async locate(location, mode = _shared_1.TransportMode.CAR) {
        const request = {
            locations: [this.toValhallaLocation(location)],
            costing: this.getCostingProfile(mode),
            verbose: true,
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/locate`, request, { timeout: this.timeout }));
            const result = response.data[0];
            if (result && result.edges && result.edges.length > 0) {
                const edge = result.edges[0];
                return {
                    latitude: edge.correlated_lat,
                    longitude: edge.correlated_lon,
                };
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Valhalla locate error: ${error.message}`, error.stack);
            return null;
        }
    }
    decodePolyline(encoded, precision = 6) {
        const coordinates = [];
        let index = 0;
        let lat = 0;
        let lng = 0;
        const factor = Math.pow(10, precision);
        while (index < encoded.length) {
            let shift = 0;
            let result = 0;
            let byte;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            const dlat = result & 1 ? ~(result >> 1) : result >> 1;
            lat += dlat;
            shift = 0;
            result = 0;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            const dlng = result & 1 ? ~(result >> 1) : result >> 1;
            lng += dlng;
            coordinates.push({
                latitude: lat / factor,
                longitude: lng / factor,
            });
        }
        return coordinates;
    }
    responseToGeoJSON(response) {
        const allCoordinates = [];
        for (const leg of response.trip.legs) {
            const decoded = this.decodePolyline(leg.shape);
            for (const coord of decoded) {
                allCoordinates.push([coord.longitude, coord.latitude]);
            }
        }
        return {
            type: 'LineString',
            coordinates: allCoordinates,
        };
    }
    async healthCheck() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/status`, { timeout: 5000 }));
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
};
exports.ValhallaService = ValhallaService;
exports.ValhallaService = ValhallaService = ValhallaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], ValhallaService);
//# sourceMappingURL=valhalla.service.js.map