import { RouteGeneratorService } from './route-generator.service';
import { ValhallaService } from './valhalla.service';
import { CreateRouteRequest, Route, CreateRouteResponse } from '@shared';
export declare class RoutingService {
    private readonly routeGenerator;
    private readonly valhallaService;
    private readonly logger;
    private routes;
    constructor(routeGenerator: RouteGeneratorService, valhallaService: ValhallaService);
    createRoute(request: CreateRouteRequest): Promise<CreateRouteResponse>;
    private createSimpleRouteWithAlternatives;
    private mapManeuverType;
    getRouteById(id: string): Promise<Route | null>;
}
