import { ConfigService } from '@nestjs/config';
import { Coordinates, RouteSettings, POI, Route } from '@shared';
import { ValhallaService } from './valhalla.service';
import { POIService } from '../poi/poi.service';
export declare class RouteGeneratorService {
    private readonly valhallaService;
    private readonly poiService;
    private readonly configService;
    private readonly logger;
    constructor(valhallaService: ValhallaService, poiService: POIService, configService: ConfigService);
    generateRoute(origin: Coordinates, destination: Coordinates, settings: RouteSettings): Promise<{
        route: Route;
        poisOnRoute: POI[];
    }>;
    private calculateCorridorWidth;
    private scorePOIs;
    private getCategoryUniqueness;
    private getClusterScore;
    private pointToLineDistance;
    private selectWaypoints;
    private optimizeWaypointOrder;
    private buildRouteResponse;
    private estimateArrivalTime;
    private mapManeuverType;
}
