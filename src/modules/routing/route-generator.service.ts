import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Coordinates,
  RouteSettings,
  POI,
  Route,
  Waypoint,
  POICategory,
} from '@shared';
import {
  haversineDistance,
  createLineBuffer,
  getBoundingBox,
  expandBoundingBox,
} from '@shared/utils/geo';
import { ValhallaService } from './valhalla.service';
import { POIService } from '../poi/poi.service';
import { ROUTING_CONSTANTS, POI_SCORING_WEIGHTS } from '@shared/constants';
import { v4 as uuidv4 } from 'uuid';

interface ScoredPOI {
  poi: POI;
  score: number;
  distanceFromLine: number;
  detourEstimate: number;
}

@Injectable()
export class RouteGeneratorService {
  private readonly logger = new Logger(RouteGeneratorService.name);

  constructor(
    private readonly valhallaService: ValhallaService,
    private readonly poiService: POIService,
    private readonly configService: ConfigService,
  ) {}

  async generateRoute(
    origin: Coordinates,
    destination: Coordinates,
    settings: RouteSettings,
  ): Promise<{ route: Route; poisOnRoute: POI[] }> {
    this.logger.log(`Generating route from ${JSON.stringify(origin)} to ${JSON.stringify(destination)}`);
    this.logger.log(`Settings: adventureLevel=${settings.adventureLevel}, maxDistance=${settings.maxDistance}`);

    // 1. Получаем базовый маршрут
    const baseRouteResponse = await this.valhallaService.route(
      origin,
      destination,
      [],
      settings.transportMode,
      {
        avoidHighways: settings.avoidHighways,
        avoidTolls: settings.avoidTolls,
      },
    );

    const baseDistance = baseRouteResponse.trip.summary.length * 1000; // в метры
    const baseDuration = baseRouteResponse.trip.summary.time;

    this.logger.log(`Base route: ${baseDistance}m, ${baseDuration}s`);

    // Если adventureLevel = 0, возвращаем базовый маршрут
    if (settings.adventureLevel === 0) {
      return this.buildRouteResponse(
        origin,
        destination,
        [],
        baseRouteResponse,
        settings,
        [],
      );
    }

    // 2. Вычисляем допустимое отклонение
    const maxDistance = settings.maxDistance || baseDistance * 1.5;
    const maxDetour = maxDistance - baseDistance;

    if (maxDetour <= 0) {
      this.logger.log('No detour allowed, returning base route');
      return this.buildRouteResponse(
        origin,
        destination,
        [],
        baseRouteResponse,
        settings,
        [],
      );
    }

    // 3. Строим коридор поиска
    const corridorWidth = this.calculateCorridorWidth(
      baseDistance,
      settings.adventureLevel,
    );
    this.logger.log(`Search corridor width: ${corridorWidth}m`);

    // 4. Ищем POI в коридоре
    const corridorPolygon = createLineBuffer(origin, destination, corridorWidth);
    const pois = await this.poiService.findInPolygon(
      corridorPolygon,
      settings.poiCategories,
      ROUTING_CONSTANTS.POI_SEARCH_LIMIT,
    );

    this.logger.log(`Found ${pois.length} POIs in corridor`);

    if (pois.length === 0) {
      return this.buildRouteResponse(
        origin,
        destination,
        [],
        baseRouteResponse,
        settings,
        [],
      );
    }

    // 5. Оцениваем и ранжируем POI
    const scoredPois = await this.scorePOIs(pois, origin, destination, settings);

    // 6. Выбираем waypoints
    const selectedWaypoints = await this.selectWaypoints(
      scoredPois,
      origin,
      destination,
      maxDistance,
      settings,
    );

    this.logger.log(`Selected ${selectedWaypoints.length} waypoints`);

    if (selectedWaypoints.length === 0) {
      return this.buildRouteResponse(
        origin,
        destination,
        [],
        baseRouteResponse,
        settings,
        [],
      );
    }

    // 7. Оптимизируем порядок waypoints
    const orderedWaypoints = await this.optimizeWaypointOrder(
      origin,
      destination,
      selectedWaypoints,
      settings,
    );

    // 8. Строим финальный маршрут
    const waypointCoords = orderedWaypoints.map((wp) => wp.poi.coordinates);
    const finalRouteResponse = await this.valhallaService.route(
      origin,
      destination,
      waypointCoords,
      settings.transportMode,
      {
        avoidHighways: settings.avoidHighways,
        avoidTolls: settings.avoidTolls,
      },
    );

    return this.buildRouteResponse(
      origin,
      destination,
      orderedWaypoints,
      finalRouteResponse,
      settings,
      orderedWaypoints.map((wp) => wp.poi),
    );
  }

  private calculateCorridorWidth(
    baseDistance: number,
    adventureLevel: number,
  ): number {
    const factor = this.configService.get<number>('routing.corridorWidthFactor') ?? 0.1;
    const baseWidth = Math.min(
      baseDistance * factor,
      ROUTING_CONSTANTS.CORRIDOR_MAX_WIDTH,
    );
    const adventureFactor = 0.5 + adventureLevel * 0.5;
    return baseWidth * adventureFactor;
  }

  private async scorePOIs(
    pois: POI[],
    origin: Coordinates,
    destination: Coordinates,
    settings: RouteSettings,
  ): Promise<ScoredPOI[]> {
    const scoredPois: ScoredPOI[] = [];

    // Вычисляем прямое расстояние для нормализации
    const directDistance = haversineDistance(origin, destination);

    for (const poi of pois) {
      // Расстояние от POI до прямой линии origin-destination
      const distanceFromLine = this.pointToLineDistance(
        poi.coordinates,
        origin,
        destination,
      );

      // Примерная оценка отклонения (через POI вместо прямо)
      const distToOrigin = haversineDistance(origin, poi.coordinates);
      const distToDestination = haversineDistance(poi.coordinates, destination);
      const detourEstimate = distToOrigin + distToDestination - directDistance;

      // Расчёт score
      let score = 0;

      // Рейтинг POI (0-1)
      const ratingScore = poi.rating ? poi.rating / 5 : 0.5;
      score += ratingScore * POI_SCORING_WEIGHTS.rating;

      // Уникальность категории (редкие категории = выше)
      const uniquenessScore = this.getCategoryUniqueness(poi.category, pois);
      score += uniquenessScore * POI_SCORING_WEIGHTS.uniqueness;

      // Близость к маршруту (ближе = лучше)
      const maxDistance = directDistance * 0.3;
      const proximityScore = Math.max(0, 1 - distanceFromLine / maxDistance);
      score += proximityScore * POI_SCORING_WEIGHTS.proximity;

      // Кластеризация (бонус если рядом другие POI)
      const clusterScore = this.getClusterScore(poi, pois);
      score += clusterScore * POI_SCORING_WEIGHTS.clustering;

      // Соответствие предпочтениям пользователя
      const preferenceScore = settings.poiCategories.includes(poi.category) ? 1 : 0.3;
      score += preferenceScore * POI_SCORING_WEIGHTS.userPreference;

      scoredPois.push({
        poi,
        score,
        distanceFromLine,
        detourEstimate,
      });
    }

    // Сортируем по score
    return scoredPois.sort((a, b) => b.score - a.score);
  }

  private getCategoryUniqueness(category: POICategory, allPois: POI[]): number {
    const categoryCount = allPois.filter((p) => p.category === category).length;
    const totalCount = allPois.length;
    // Чем реже категория, тем выше score
    return 1 - categoryCount / totalCount;
  }

  private getClusterScore(poi: POI, allPois: POI[]): number {
    const clusterRadius = 1000; // 1 км
    let nearbyCount = 0;

    for (const other of allPois) {
      if (other.id === poi.id) continue;
      const distance = haversineDistance(poi.coordinates, other.coordinates);
      if (distance <= clusterRadius) {
        nearbyCount++;
      }
    }

    // Нормализуем: 0-3+ POI рядом -> 0-1
    return Math.min(nearbyCount / 3, 1);
  }

  private pointToLineDistance(
    point: Coordinates,
    lineStart: Coordinates,
    lineEnd: Coordinates,
  ): number {
    // Упрощённый расчёт расстояния от точки до линии
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

    let closestLat: number;
    let closestLng: number;

    if (param < 0) {
      closestLat = lineStart.latitude;
      closestLng = lineStart.longitude;
    } else if (param > 1) {
      closestLat = lineEnd.latitude;
      closestLng = lineEnd.longitude;
    } else {
      closestLat = lineStart.latitude + param * C;
      closestLng = lineStart.longitude + param * D;
    }

    return haversineDistance(point, { latitude: closestLat, longitude: closestLng });
  }

  private async selectWaypoints(
    scoredPois: ScoredPOI[],
    origin: Coordinates,
    destination: Coordinates,
    maxDistance: number,
    settings: RouteSettings,
  ): Promise<ScoredPOI[]> {
    const selected: ScoredPOI[] = [];
    const maxWaypoints = this.configService.get<number>('routing.maxWaypoints') ?? 10;

    // Базовое расстояние
    let currentEstimatedDistance = haversineDistance(origin, destination);

    for (const scoredPoi of scoredPois) {
      // Проверяем лимит waypoints
      if (selected.length >= maxWaypoints) break;

      // Проверяем что не превысим maxDistance
      const newEstimatedDistance = currentEstimatedDistance + scoredPoi.detourEstimate;
      if (newEstimatedDistance > maxDistance) continue;

      // Проверяем минимальное расстояние между waypoints
      const tooClose = selected.some(
        (s) =>
          haversineDistance(s.poi.coordinates, scoredPoi.poi.coordinates) <
          ROUTING_CONSTANTS.MIN_WAYPOINT_DISTANCE,
      );
      if (tooClose) continue;

      selected.push(scoredPoi);
      currentEstimatedDistance = newEstimatedDistance;
    }

    return selected;
  }

  private async optimizeWaypointOrder(
    origin: Coordinates,
    destination: Coordinates,
    waypoints: ScoredPOI[],
    settings: RouteSettings,
  ): Promise<ScoredPOI[]> {
    if (waypoints.length <= 2) {
      // Для 1-2 точек оптимизация не нужна
      return waypoints;
    }

    try {
      // Используем Valhalla optimized_route
      const allLocations = [
        origin,
        ...waypoints.map((wp) => wp.poi.coordinates),
        destination,
      ];

      const optimizedResponse = await this.valhallaService.optimizedRoute(
        allLocations,
        settings.transportMode,
      );

      // Извлекаем оптимальный порядок из ответа
      const orderedLocations = optimizedResponse.trip.locations;
      const reorderedWaypoints: ScoredPOI[] = [];

      // Пропускаем первую (origin) и последнюю (destination) точки
      for (let i = 1; i < orderedLocations.length - 1; i++) {
        const loc = orderedLocations[i];
        const matchingWaypoint = waypoints.find(
          (wp) =>
            Math.abs(wp.poi.coordinates.latitude - loc.lat) < 0.0001 &&
            Math.abs(wp.poi.coordinates.longitude - loc.lon) < 0.0001,
        );
        if (matchingWaypoint) {
          reorderedWaypoints.push(matchingWaypoint);
        }
      }

      return reorderedWaypoints;
    } catch (error) {
      this.logger.warn(`Failed to optimize waypoint order: ${error.message}`);
      // Fallback: сортируем по расстоянию от origin
      return waypoints.sort(
        (a, b) =>
          haversineDistance(origin, a.poi.coordinates) -
          haversineDistance(origin, b.poi.coordinates),
      );
    }
  }

  private buildRouteResponse(
    origin: Coordinates,
    destination: Coordinates,
    waypoints: ScoredPOI[],
    valhallaResponse: any,
    settings: RouteSettings,
    poisOnRoute: POI[],
  ): { route: Route; poisOnRoute: POI[] } {
    const geometry = this.valhallaService.responseToGeoJSON(valhallaResponse);

    const routeWaypoints: Waypoint[] = [
      { coordinates: origin, type: 'origin' },
      ...waypoints.map((wp, index) => ({
        coordinates: wp.poi.coordinates,
        poi: wp.poi,
        type: 'poi' as const,
        arrivalTime: this.estimateArrivalTime(valhallaResponse, index + 1),
      })),
      { coordinates: destination, type: 'destination' },
    ];

    const route: Route = {
      id: uuidv4(),
      origin,
      destination,
      waypoints: routeWaypoints,
      geometry,
      distance: Math.round(valhallaResponse.trip.summary.length * 1000),
      duration: Math.round(valhallaResponse.trip.summary.time),
      legs: valhallaResponse.trip.legs.map((leg: any, index: number) => ({
        startIndex: index,
        endIndex: index + 1,
        distance: Math.round(leg.summary.length * 1000),
        duration: Math.round(leg.summary.time),
        geometry: {
          type: 'LineString' as const,
          coordinates: this.valhallaService
            .decodePolyline(leg.shape)
            .map((c) => [c.longitude, c.latitude]),
        },
        maneuvers: leg.maneuvers.map((m: any) => ({
          type: this.mapManeuverType(m.type),
          instruction: m.instruction,
          coordinates: { latitude: 0, longitude: 0 }, // TODO: extract from shape
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

  private estimateArrivalTime(valhallaResponse: any, waypointIndex: number): number {
    let totalTime = 0;
    for (let i = 0; i < waypointIndex && i < valhallaResponse.trip.legs.length; i++) {
      totalTime += valhallaResponse.trip.legs[i].summary.time;
    }
    return totalTime;
  }

  private mapManeuverType(valhallaType: number): string {
    // Маппинг типов манёвров Valhalla на наши
    const mapping: Record<number, string> = {
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
      // ... и так далее
    };
    return mapping[valhallaType] || 'continue';
  }
}
