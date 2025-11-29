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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutingService = void 0;
const common_1 = require("@nestjs/common");
const route_generator_service_1 = require("./route-generator.service");
const _shared_1 = require("../../../shared");
const uuid_1 = require("uuid");
let RoutingService = class RoutingService {
    constructor(routeGenerator) {
        this.routeGenerator = routeGenerator;
        this.routes = new Map();
    }
    async createRoute(request) {
        const settings = {
            ..._shared_1.DEFAULT_ROUTE_SETTINGS,
            ...request.settings,
        };
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
    async getRouteById(id) {
        return this.routes.get(id) || null;
    }
};
exports.RoutingService = RoutingService;
exports.RoutingService = RoutingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [route_generator_service_1.RouteGeneratorService])
], RoutingService);
//# sourceMappingURL=routing.service.js.map