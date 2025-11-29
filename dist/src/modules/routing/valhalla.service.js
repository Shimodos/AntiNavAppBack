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
        this.osrmBaseUrl = 'https://router.project-osrm.org';
        this.valhallaAvailable = null;
        this.baseUrl = this.configService.get('valhalla.url') ?? 'http://localhost:8002';
        this.timeout = this.configService.get('valhalla.timeout') ?? 30000;
    }
    async isValhallaAvailable() {
        if (this.valhallaAvailable !== null) {
            return this.valhallaAvailable;
        }
        this.valhallaAvailable = await this.healthCheck();
        setTimeout(() => { this.valhallaAvailable = null; }, 30000);
        return this.valhallaAvailable;
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
        const valhallaReady = await this.isValhallaAvailable();
        if (!valhallaReady) {
            this.logger.warn('Valhalla not available, falling back to OSRM for route');
            const osrmRoutes = await this.routeWithOSRM(origin, destination, mode, 0);
            if (osrmRoutes.length > 0) {
                return osrmRoutes[0];
            }
            throw new Error('No route found from OSRM');
        }
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
            alternates: options?.alternates,
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/route`, request, { timeout: this.timeout }));
            return response.data;
        }
        catch (error) {
            this.logger.error(`Valhalla route error: ${error.message}`, error.stack);
            this.logger.warn('Falling back to OSRM due to Valhalla error');
            const osrmRoutes = await this.routeWithOSRM(origin, destination, mode, 0);
            if (osrmRoutes.length > 0) {
                return osrmRoutes[0];
            }
            throw error;
        }
    }
    async routeWithAlternatives(origin, destination, mode = _shared_1.TransportMode.CAR, numAlternatives = 2, options) {
        const valhallaReady = await this.isValhallaAvailable();
        if (!valhallaReady) {
            this.logger.warn('Valhalla not available, falling back to OSRM');
            return this.routeWithOSRM(origin, destination, mode, numAlternatives);
        }
        const locations = [
            this.toValhallaLocation(origin, 'break'),
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
            alternates: numAlternatives,
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/route`, request, { timeout: this.timeout }));
            const routes = [];
            if (response.data.trip) {
                routes.push({ trip: response.data.trip });
            }
            if (response.data.alternates) {
                for (const alt of response.data.alternates) {
                    if (alt.trip) {
                        routes.push({ trip: alt.trip });
                    }
                }
            }
            return routes;
        }
        catch (error) {
            this.logger.error(`Valhalla route with alternatives error: ${error.message}`, error.stack);
            this.logger.warn('Falling back to OSRM due to Valhalla error');
            return this.routeWithOSRM(origin, destination, mode, numAlternatives);
        }
    }
    async routeWithOSRM(origin, destination, mode, numAlternatives) {
        const profile = mode === _shared_1.TransportMode.CAR ? 'driving' :
            mode === _shared_1.TransportMode.BICYCLE ? 'cycling' : 'foot';
        const alternativesParam = numAlternatives > 0 ? 'true' : 'false';
        const url = `${this.osrmBaseUrl}/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline6&alternatives=${alternativesParam}&steps=true`;
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, { timeout: this.timeout }));
            if (response.data.code !== 'Ok' || !response.data.routes?.length) {
                throw new Error('OSRM returned no routes');
            }
            const routes = response.data.routes.map((osrmRoute) => this.convertOSRMToValhalla(osrmRoute));
            if (numAlternatives >= 2 && routes.length < 3) {
                try {
                    const scenicRoute1 = await this.generateScenicRoute(origin, destination, profile, 1);
                    if (scenicRoute1) {
                        routes.push(scenicRoute1);
                    }
                }
                catch (e) {
                    this.logger.warn(`Failed to generate scenic route 1: ${e.message}`);
                }
                if (routes.length < 3) {
                    try {
                        const scenicRoute2 = await this.generateScenicRoute(origin, destination, profile, -1);
                        if (scenicRoute2) {
                            routes.push(scenicRoute2);
                        }
                    }
                    catch (e) {
                        this.logger.warn(`Failed to generate scenic route 2: ${e.message}`);
                    }
                }
            }
            return routes;
        }
        catch (error) {
            this.logger.error(`OSRM route error: ${error.message}`);
            throw error;
        }
    }
    async generateScenicRoute(origin, destination, profile, direction = 1) {
        const midLat = (origin.latitude + destination.latitude) / 2;
        const midLng = (origin.longitude + destination.longitude) / 2;
        const dLat = destination.latitude - origin.latitude;
        const dLng = destination.longitude - origin.longitude;
        const distance = Math.sqrt(dLat * dLat + dLng * dLng);
        const offsetFactor = 0.3 * direction;
        const perpLat = -dLng / distance * offsetFactor * distance;
        const perpLng = dLat / distance * offsetFactor * distance;
        const detourPoint = {
            latitude: midLat + perpLat,
            longitude: midLng + perpLng,
        };
        const url = `${this.osrmBaseUrl}/route/v1/${profile}/${origin.longitude},${origin.latitude};${detourPoint.longitude},${detourPoint.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline6&steps=true`;
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, { timeout: this.timeout }));
            if (response.data.code === 'Ok' && response.data.routes?.length > 0) {
                const side = direction > 0 ? 'left' : 'right';
                this.logger.log(`Generated scenic route via detour point (${side} side)`);
                return this.convertOSRMToValhalla(response.data.routes[0]);
            }
        }
        catch (e) {
            this.logger.warn(`Scenic route request failed: ${e.message}`);
        }
        return null;
    }
    convertOSRMToValhalla(osrmRoute) {
        const allManeuvers = [];
        let maneuverIndex = 0;
        for (const leg of osrmRoute.legs) {
            if (leg.steps) {
                for (const step of leg.steps) {
                    allManeuvers.push({
                        type: this.mapOSRMManeuverType(step.maneuver?.type),
                        instruction: step.name || step.maneuver?.type || 'Continue',
                        begin_shape_index: maneuverIndex,
                        end_shape_index: maneuverIndex + 1,
                        length: (step.distance || 0) / 1000,
                        time: step.duration || 0,
                        travel_mode: 'drive',
                        travel_type: 'car',
                    });
                    maneuverIndex++;
                }
            }
        }
        const singleLeg = {
            maneuvers: allManeuvers,
            summary: {
                length: (osrmRoute.distance || 0) / 1000,
                time: osrmRoute.duration || 0,
            },
            shape: osrmRoute.geometry,
        };
        return {
            trip: {
                locations: [],
                legs: [singleLeg],
                summary: {
                    length: (osrmRoute.distance || 0) / 1000,
                    time: osrmRoute.duration || 0,
                    min_lat: 0,
                    min_lon: 0,
                    max_lat: 0,
                    max_lon: 0,
                },
                status: 0,
                status_message: 'Found route',
                units: 'kilometers',
                language: 'en-US',
            },
        };
    }
    mapOSRMManeuverType(osrmType) {
        const mapping = {
            'depart': 1,
            'arrive': 4,
            'turn': 9,
            'continue': 7,
            'new name': 7,
            'slight right': 8,
            'right': 9,
            'sharp right': 10,
            'slight left': 15,
            'left': 14,
            'sharp left': 13,
            'uturn': 12,
        };
        return mapping[osrmType] || 7;
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