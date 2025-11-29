import { RouteGeneratorService } from './route-generator.service';
import { CreateRouteRequest, Route, CreateRouteResponse } from '@shared';
export declare class RoutingService {
    private readonly routeGenerator;
    private routes;
    constructor(routeGenerator: RouteGeneratorService);
    createRoute(request: CreateRouteRequest): Promise<CreateRouteResponse>;
    getRouteById(id: string): Promise<Route | null>;
}
