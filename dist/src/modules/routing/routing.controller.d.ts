import { RoutingService } from './routing.service';
import { CreateRouteRequest } from '@shared';
export declare class RoutingController {
    private readonly routingService;
    constructor(routingService: RoutingService);
    createRoute(request: CreateRouteRequest): Promise<import("@shared").CreateRouteResponse>;
    getRoute(id: string): Promise<import("@shared").Route | null>;
}
