import { Injectable, Logger } from '@nestjs/common';
import { RouteGeneratorService } from './route-generator.service';
import { ValhallaService } from './valhalla.service';
import { CreateRouteRequest, Route, CreateRouteResponse, DEFAULT_ROUTE_SETTINGS, Waypoint, TransportMode } from '@shared';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private routes = new Map<string, Route>();

  constructor(
    private readonly routeGenerator: RouteGeneratorService,
    private readonly valhallaService: ValhallaService,
  ) {}

  async createRoute(request: CreateRouteRequest): Promise<CreateRouteResponse> {
    const settings = {
      ...DEFAULT_ROUTE_SETTINGS,
      ...request.settings,
    };

    // For simple navigation (no adventure mode), get direct route with alternatives
    if (settings.adventureLevel === 0 || !settings.poiCategories?.length) {
      return this.createSimpleRouteWithAlternatives(request, settings);
    }

    // Full POI-enhanced route generation
    const { route, poisOnRoute } = await this.routeGenerator.generateRoute(
      request.origin,
      request.destination,
      settings,
    );

    const routeWithId: Route = {
      ...route,
      id: uuid(),
    };

    this.routes.set(routeWithId.id, routeWithId);

    return {
      route: routeWithId,
      poisOnRoute,
    };
  }

  private async createSimpleRouteWithAlternatives(
    request: CreateRouteRequest,
    settings: any,
  ): Promise<CreateRouteResponse> {
    try {
      const routeResponses = await this.valhallaService.routeWithAlternatives(
        request.origin,
        request.destination,
        settings.transportMode || TransportMode.PEDESTRIAN,
        2, // Get 2 alternatives
        {
          avoidHighways: settings.avoidHighways,
          avoidTolls: settings.avoidTolls,
        },
      );

      if (routeResponses.length === 0) {
        throw new Error('No routes found');
      }

      const routes: Route[] = routeResponses.map((valhallaResponse, index) => {
        const geometry = this.valhallaService.responseToGeoJSON(valhallaResponse);
        const routeWaypoints: Waypoint[] = [
          { coordinates: request.origin, type: 'origin' },
          { coordinates: request.destination, type: 'destination' },
        ];

        const route: Route = {
          id: uuid(),
          origin: request.origin,
          destination: request.destination,
          waypoints: routeWaypoints,
          geometry,
          distance: Math.round(valhallaResponse.trip.summary.length * 1000),
          duration: Math.round(valhallaResponse.trip.summary.time),
          legs: valhallaResponse.trip.legs.map((leg: any, legIndex: number) => ({
            startIndex: legIndex,
            endIndex: legIndex + 1,
            distance: Math.round(leg.summary.length * 1000),
            duration: Math.round(leg.summary.time),
            geometry: {
              type: 'LineString' as const,
              coordinates: this.valhallaService
                .decodePolyline(leg.shape)
                .map((c) => [c.longitude, c.latitude]),
            },
            maneuvers: leg.maneuvers?.map((m: any) => ({
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
    } catch (error) {
      this.logger.error(`Error creating simple route: ${error.message}`);
      throw error;
    }
  }

  private mapManeuverType(valhallaType: number): string {
    const mapping: Record<number, string> = {
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

  async getRouteById(id: string): Promise<Route | null> {
    return this.routes.get(id) || null;
  }
}
