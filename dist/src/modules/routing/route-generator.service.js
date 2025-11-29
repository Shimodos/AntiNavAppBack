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
var RouteGeneratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const geo_1 = require("../../../shared/utils/geo");
const valhalla_service_1 = require("./valhalla.service");
const poi_service_1 = require("../poi/poi.service");
const constants_1 = require("../../../shared/constants");
const uuid_1 = require("uuid");
let RouteGeneratorService = RouteGeneratorService_1 = class RouteGeneratorService {
    constructor(valhallaService, poiService, configService) {
        this.valhallaService = valhallaService;
        this.poiService = poiService;
        this.configService = configService;
        this.logger = new common_1.Logger(RouteGeneratorService_1.name);
    }
    async generateRoute(origin, destination, settings) {
        this.logger.log(`Generating route from ${JSON.stringify(origin)} to ${JSON.stringify(destination)}`);
        this.logger.log(`Settings: adventureLevel=${settings.adventureLevel}, maxDistance=${settings.maxDistance}`);
        const baseRouteResponse = await this.valhallaService.route(origin, destination, [], settings.transportMode, {
            avoidHighways: settings.avoidHighways,
            avoidTolls: settings.avoidTolls,
        });
        const baseDistance = baseRouteResponse.trip.summary.length * 1000;
        const baseDuration = baseRouteResponse.trip.summary.time;
        this.logger.log(`Base route: ${baseDistance}m, ${baseDuration}s`);
        if (settings.adventureLevel === 0) {
            return this.buildRouteResponse(origin, destination, [], baseRouteResponse, settings, []);
        }
        const maxDistance = settings.maxDistance || baseDistance * 1.5;
        const maxDetour = maxDistance - baseDistance;
        if (maxDetour <= 0) {
            this.logger.log('No detour allowed, returning base route');
            return this.buildRouteResponse(origin, destination, [], baseRouteResponse, settings, []);
        }
        const corridorWidth = this.calculateCorridorWidth(baseDistance, settings.adventureLevel);
        this.logger.log(`Search corridor width: ${corridorWidth}m`);
        const corridorPolygon = (0, geo_1.createLineBuffer)(origin, destination, corridorWidth);
        const pois = await this.poiService.findInPolygon(corridorPolygon, settings.poiCategories, constants_1.ROUTING_CONSTANTS.POI_SEARCH_LIMIT);
        this.logger.log(`Found ${pois.length} POIs in corridor`);
        if (pois.length === 0) {
            return this.buildRouteResponse(origin, destination, [], baseRouteResponse, settings, []);
        }
        const scoredPois = await this.scorePOIs(pois, origin, destination, settings);
        const selectedWaypoints = await this.selectWaypoints(scoredPois, origin, destination, maxDistance, settings);
        this.logger.log(`Selected ${selectedWaypoints.length} waypoints`);
        if (selectedWaypoints.length === 0) {
            return this.buildRouteResponse(origin, destination, [], baseRouteResponse, settings, []);
        }
        const orderedWaypoints = await this.optimizeWaypointOrder(origin, destination, selectedWaypoints, settings);
        const waypointCoords = orderedWaypoints.map((wp) => wp.poi.coordinates);
        const finalRouteResponse = await this.valhallaService.route(origin, destination, waypointCoords, settings.transportMode, {
            avoidHighways: settings.avoidHighways,
            avoidTolls: settings.avoidTolls,
        });
        return this.buildRouteResponse(origin, destination, orderedWaypoints, finalRouteResponse, settings, orderedWaypoints.map((wp) => wp.poi));
    }
    calculateCorridorWidth(baseDistance, adventureLevel) {
        const factor = this.configService.get('routing.corridorWidthFactor') ?? 0.1;
        const baseWidth = Math.min(baseDistance * factor, constants_1.ROUTING_CONSTANTS.CORRIDOR_MAX_WIDTH);
        const adventureFactor = 0.5 + adventureLevel * 0.5;
        return baseWidth * adventureFactor;
    }
    async scorePOIs(pois, origin, destination, settings) {
        const scoredPois = [];
        const directDistance = (0, geo_1.haversineDistance)(origin, destination);
        for (const poi of pois) {
            const distanceFromLine = this.pointToLineDistance(poi.coordinates, origin, destination);
            const distToOrigin = (0, geo_1.haversineDistance)(origin, poi.coordinates);
            const distToDestination = (0, geo_1.haversineDistance)(poi.coordinates, destination);
            const detourEstimate = distToOrigin + distToDestination - directDistance;
            let score = 0;
            const ratingScore = poi.rating ? poi.rating / 5 : 0.5;
            score += ratingScore * constants_1.POI_SCORING_WEIGHTS.rating;
            const uniquenessScore = this.getCategoryUniqueness(poi.category, pois);
            score += uniquenessScore * constants_1.POI_SCORING_WEIGHTS.uniqueness;
            const maxDistance = directDistance * 0.3;
            const proximityScore = Math.max(0, 1 - distanceFromLine / maxDistance);
            score += proximityScore * constants_1.POI_SCORING_WEIGHTS.proximity;
            const clusterScore = this.getClusterScore(poi, pois);
            score += clusterScore * constants_1.POI_SCORING_WEIGHTS.clustering;
            const preferenceScore = settings.poiCategories.includes(poi.category) ? 1 : 0.3;
            score += preferenceScore * constants_1.POI_SCORING_WEIGHTS.userPreference;
            scoredPois.push({
                poi,
                score,
                distanceFromLine,
                detourEstimate,
            });
        }
        return scoredPois.sort((a, b) => b.score - a.score);
    }
    getCategoryUniqueness(category, allPois) {
        const categoryCount = allPois.filter((p) => p.category === category).length;
        const totalCount = allPois.length;
        return 1 - categoryCount / totalCount;
    }
    getClusterScore(poi, allPois) {
        const clusterRadius = 1000;
        let nearbyCount = 0;
        for (const other of allPois) {
            if (other.id === poi.id)
                continue;
            const distance = (0, geo_1.haversineDistance)(poi.coordinates, other.coordinates);
            if (distance <= clusterRadius) {
                nearbyCount++;
            }
        }
        return Math.min(nearbyCount / 3, 1);
    }
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.latitude - lineStart.latitude;
        const B = point.longitude - lineStart.longitude;
        const C = lineEnd.latitude - lineStart.latitude;
        const D = lineEnd.longitude - lineStart.longitude;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        let closestLat;
        let closestLng;
        if (param < 0) {
            closestLat = lineStart.latitude;
            closestLng = lineStart.longitude;
        }
        else if (param > 1) {
            closestLat = lineEnd.latitude;
            closestLng = lineEnd.longitude;
        }
        else {
            closestLat = lineStart.latitude + param * C;
            closestLng = lineStart.longitude + param * D;
        }
        return (0, geo_1.haversineDistance)(point, { latitude: closestLat, longitude: closestLng });
    }
    async selectWaypoints(scoredPois, origin, destination, maxDistance, settings) {
        const selected = [];
        const maxWaypoints = this.configService.get('routing.maxWaypoints') ?? 10;
        let currentEstimatedDistance = (0, geo_1.haversineDistance)(origin, destination);
        for (const scoredPoi of scoredPois) {
            if (selected.length >= maxWaypoints)
                break;
            const newEstimatedDistance = currentEstimatedDistance + scoredPoi.detourEstimate;
            if (newEstimatedDistance > maxDistance)
                continue;
            const tooClose = selected.some((s) => (0, geo_1.haversineDistance)(s.poi.coordinates, scoredPoi.poi.coordinates) <
                constants_1.ROUTING_CONSTANTS.MIN_WAYPOINT_DISTANCE);
            if (tooClose)
                continue;
            selected.push(scoredPoi);
            currentEstimatedDistance = newEstimatedDistance;
        }
        return selected;
    }
    async optimizeWaypointOrder(origin, destination, waypoints, settings) {
        if (waypoints.length <= 2) {
            return waypoints;
        }
        try {
            const allLocations = [
                origin,
                ...waypoints.map((wp) => wp.poi.coordinates),
                destination,
            ];
            const optimizedResponse = await this.valhallaService.optimizedRoute(allLocations, settings.transportMode);
            const orderedLocations = optimizedResponse.trip.locations;
            const reorderedWaypoints = [];
            for (let i = 1; i < orderedLocations.length - 1; i++) {
                const loc = orderedLocations[i];
                const matchingWaypoint = waypoints.find((wp) => Math.abs(wp.poi.coordinates.latitude - loc.lat) < 0.0001 &&
                    Math.abs(wp.poi.coordinates.longitude - loc.lon) < 0.0001);
                if (matchingWaypoint) {
                    reorderedWaypoints.push(matchingWaypoint);
                }
            }
            return reorderedWaypoints;
        }
        catch (error) {
            this.logger.warn(`Failed to optimize waypoint order: ${error.message}`);
            return waypoints.sort((a, b) => (0, geo_1.haversineDistance)(origin, a.poi.coordinates) -
                (0, geo_1.haversineDistance)(origin, b.poi.coordinates));
        }
    }
    buildRouteResponse(origin, destination, waypoints, valhallaResponse, settings, poisOnRoute) {
        const geometry = this.valhallaService.responseToGeoJSON(valhallaResponse);
        const routeWaypoints = [
            { coordinates: origin, type: 'origin' },
            ...waypoints.map((wp, index) => ({
                coordinates: wp.poi.coordinates,
                poi: wp.poi,
                type: 'poi',
                arrivalTime: this.estimateArrivalTime(valhallaResponse, index + 1),
            })),
            { coordinates: destination, type: 'destination' },
        ];
        const route = {
            id: (0, uuid_1.v4)(),
            origin,
            destination,
            waypoints: routeWaypoints,
            geometry,
            distance: Math.round(valhallaResponse.trip.summary.length * 1000),
            duration: Math.round(valhallaResponse.trip.summary.time),
            legs: valhallaResponse.trip.legs.map((leg, index) => ({
                startIndex: index,
                endIndex: index + 1,
                distance: Math.round(leg.summary.length * 1000),
                duration: Math.round(leg.summary.time),
                geometry: {
                    type: 'LineString',
                    coordinates: this.valhallaService
                        .decodePolyline(leg.shape)
                        .map((c) => [c.longitude, c.latitude]),
                },
                maneuvers: leg.maneuvers.map((m) => ({
                    type: this.mapManeuverType(m.type),
                    instruction: m.instruction,
                    coordinates: { latitude: 0, longitude: 0 },
                    bearingBefore: 0,
                    bearingAfter: 0,
                    distance: Math.round(m.length * 1000),
                    duration: Math.round(m.time),
                })),
            })),
            settings,
            createdAt: new Date(),
        };
        return { route, poisOnRoute };
    }
    estimateArrivalTime(valhallaResponse, waypointIndex) {
        let totalTime = 0;
        for (let i = 0; i < waypointIndex && i < valhallaResponse.trip.legs.length; i++) {
            totalTime += valhallaResponse.trip.legs[i].summary.time;
        }
        return totalTime;
    }
    mapManeuverType(valhallaType) {
        const mapping = {
            0: 'none',
            1: 'depart',
            2: 'depart_right',
            3: 'depart_left',
            4: 'arrive',
            5: 'arrive_right',
            6: 'arrive_left',
            7: 'continue',
            8: 'turn_slight_right',
            9: 'turn_right',
            10: 'turn_sharp_right',
            11: 'uturn_right',
            12: 'uturn_left',
            13: 'turn_sharp_left',
            14: 'turn_left',
            15: 'turn_slight_left',
        };
        return mapping[valhallaType] || 'continue';
    }
};
exports.RouteGeneratorService = RouteGeneratorService;
exports.RouteGeneratorService = RouteGeneratorService = RouteGeneratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [valhalla_service_1.ValhallaService,
        poi_service_1.POIService,
        config_1.ConfigService])
], RouteGeneratorService);
//# sourceMappingURL=route-generator.service.js.map