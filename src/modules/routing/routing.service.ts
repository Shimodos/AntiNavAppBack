import { Injectable } from '@nestjs/common';
import { RouteGeneratorService } from './route-generator.service';
import { CreateRouteRequest, Route, CreateRouteResponse, DEFAULT_ROUTE_SETTINGS } from '@shared';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RoutingService {
  private routes = new Map<string, Route>();

  constructor(private readonly routeGenerator: RouteGeneratorService) {}

  async createRoute(request: CreateRouteRequest): Promise<CreateRouteResponse> {
    const settings = {
      ...DEFAULT_ROUTE_SETTINGS,
      ...request.settings,
    };

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

  async getRouteById(id: string): Promise<Route | null> {
    return this.routes.get(id) || null;
  }
}
