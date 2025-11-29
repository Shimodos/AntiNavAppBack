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
var RoutingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutingService = void 0;
const common_1 = require("@nestjs/common");
const route_generator_service_1 = require("./route-generator.service");
const valhalla_service_1 = require("./valhalla.service");
const _shared_1 = require("../../../shared");
const uuid_1 = require("uuid");
let RoutingService = RoutingService_1 = class RoutingService {
    constructor(routeGenerator, valhallaService) {
        this.routeGenerator = routeGenerator;
        this.valhallaService = valhallaService;
        this.logger = new common_1.Logger(RoutingService_1.name);
        this.routes = new Map();
    }
    async createRoute(request) {
        const settings = {
            ..._shared_1.DEFAULT_ROUTE_SETTINGS,
            ...request.settings,
        };
        if (settings.adventureLevel === 0 || !settings.poiCategories?.length) {
            return this.createSimpleRouteWithAlternatives(request, settings);
        }
        const { route, poisOnRoute } = await this.routeGenerator.generateRoute(request.origin, request.destination, settings);
        const routeWithId = {
            ...route,
            id: (0, uuid_1.v4)(),
        };
        this.routes.set(routeWithId.id, routeWithId);
        return {
            route: routeWithId,
            poisOnRoute,
        };
    }
    async createSimpleRouteWithAlternatives(request, settings) {
        try {
            const routeResponses = await this.valhallaService.routeWithAlternatives(request.origin, request.destination, settings.transportMode || _shared_1.TransportMode.PEDESTRIAN, 2, {
                avoidHighways: settings.avoidHighways,
                avoidTolls: settings.avoidTolls,
            });
            if (routeResponses.length === 0) {
                throw new Error('No routes found');
            }
            const routes = routeResponses.map((valhallaResponse, index) => {
                const geometry = this.valhallaService.responseToGeoJSON(valhallaResponse);
                const routeWaypoints = [
                    { coordinates: request.origin, type: 'origin' },
                    { coordinates: request.destination, type: 'destination' },
                ];
                const route = {
                    id: (0, uuid_1.v4)(),
                    origin: request.origin,
                    destination: request.destination,
                    waypoints: routeWaypoints,
                    geometry,
                    distance: Math.round(valhallaResponse.trip.summary.length * 1000),
                    duration: Math.round(valhallaResponse.trip.summary.time),
                    legs: valhallaResponse.trip.legs.map((leg, legIndex) => ({
                        startIndex: legIndex,
                        endIndex: legIndex + 1,
                        distance: Math.round(leg.summary.length * 1000),
                        duration: Math.round(leg.summary.time),
                        geometry: {
                            type: 'LineString',
                            coordinates: this.valhallaService
                                .decodePolyline(leg.shape)
                                .map((c) => [c.longitude, c.latitude]),
                        },
                        maneuvers: leg.maneuvers?.map((m) => ({
                            type: this.mapManeuverType(m.type),
                            instruction: m.instruction,
                            coordinates: { latitude: 0, longitude: 0 },
                            bearingBefore: 0,
                            bearingAfter: 0,
                            distance: Math.round(m.length * 1000),
                            duration: Math.round(m.time),
                        })) || [],
                    })),
                    settings,
                    createdAt: new Date(),
                };
                this.routes.set(route.id, route);
                return route;
            });
            const mainRoute = routes[0];
            const alternativeRoutes = routes.slice(1);
            this.logger.log(`Created route with ${alternativeRoutes.length} alternatives`);
            return {
                route: mainRoute,
                alternativeRoutes: alternativeRoutes.length > 0 ? alternativeRoutes : undefined,
                poisOnRoute: [],
            };
        }
        catch (error) {
            this.logger.error(`Error creating simple route: ${error.message}`);
            throw error;
        }
    }
    mapManeuverType(valhallaType) {
        const mapping = {
            0: 'none',
            1: 'depart',
            4: 'arrive',
            7: 'continue',
            8: 'turn_slight_right',
            9: 'turn_right',
            14: 'turn_left',
            15: 'turn_slight_left',
        };
        return mapping[valhallaType] || 'continue';
    }
    async getRouteById(id) {
        return this.routes.get(id) || null;
    }
};
exports.RoutingService = RoutingService;
exports.RoutingService = RoutingService = RoutingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [route_generator_service_1.RouteGeneratorService,
        valhalla_service_1.ValhallaService])
], RoutingService);
//# sourceMappingURL=routing.service.js.map