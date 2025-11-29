import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Coordinates, TransportMode, GeoJSONLineString } from '@shared';

export interface ValhallaLocation {
  lat: number;
  lon: number;
  type?: 'break' | 'through' | 'via';
}

export interface ValhallaRouteRequest {
  locations: ValhallaLocation[];
  costing: string;
  costing_options?: Record<string, any>;
  directions_options?: {
    units?: 'kilometers' | 'miles';
    language?: string;
  };
  alternates?: number;
  id?: string;
}

export interface ValhallaRouteResponse {
  trip: {
    locations: ValhallaLocation[];
    legs: ValhallaLeg[];
    summary: {
      length: number;
      time: number;
      min_lat: number;
      min_lon: number;
      max_lat: number;
      max_lon: number;
    };
    status: number;
    status_message: string;
    units: string;
    language: string;
  };
  id?: string;
}

export interface ValhallaLeg {
  maneuvers: ValhallaManeuver[];
  summary: {
    length: number;
    time: number;
  };
  shape: string; // Encoded polyline
}

export interface ValhallaManeuver {
  type: number;
  instruction: string;
  begin_shape_index: number;
  end_shape_index: number;
  length: number;
  time: number;
  travel_mode: string;
  travel_type: string;
}

export interface ValhallaIsochroneRequest {
  locations: ValhallaLocation[];
  costing: string;
  contours: { time?: number; distance?: number }[];
  polygons?: boolean;
  denoise?: number;
  generalize?: number;
}

export interface ValhallaOptimizedRouteRequest {
  locations: ValhallaLocation[];
  costing: string;
  costing_options?: Record<string, any>;
}

@Injectable()
export class ValhallaService {
  private readonly logger = new Logger(ValhallaService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly osrmBaseUrl = 'https://router.project-osrm.org';
  private valhallaAvailable: boolean | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('valhalla.url') ?? 'http://localhost:8002';
    this.timeout = this.configService.get<number>('valhalla.timeout') ?? 30000;
  }

  // Check if Valhalla is available, with caching
  private async isValhallaAvailable(): Promise<boolean> {
    if (this.valhallaAvailable !== null) {
      return this.valhallaAvailable;
    }
    this.valhallaAvailable = await this.healthCheck();
    // Reset cache after 30 seconds
    setTimeout(() => { this.valhallaAvailable = null; }, 30000);
    return this.valhallaAvailable;
  }

  // Маппинг транспорта на Valhalla costing
  private getCostingProfile(mode: TransportMode): string {
    const mapping: Record<TransportMode, string> = {
      [TransportMode.CAR]: 'auto',
      [TransportMode.BICYCLE]: 'bicycle',
      [TransportMode.PEDESTRIAN]: 'pedestrian',
    };
    return mapping[mode] || 'auto';
  }

  // Преобразование координат в формат Valhalla
  private toValhallaLocation(
    coords: Coordinates,
    type: 'break' | 'through' | 'via' = 'break',
  ): ValhallaLocation {
    return {
      lat: coords.latitude,
      lon: coords.longitude,
      type,
    };
  }

  // Построение маршрута
  async route(
    origin: Coordinates,
    destination: Coordinates,
    waypoints: Coordinates[] = [],
    mode: TransportMode = TransportMode.CAR,
    options?: {
      avoidHighways?: boolean;
      avoidTolls?: boolean;
      alternates?: number;
    },
  ): Promise<ValhallaRouteResponse> {
    // Check if Valhalla is available, fallback to OSRM if not
    const valhallaReady = await this.isValhallaAvailable();
    if (!valhallaReady) {
      this.logger.warn('Valhalla not available, falling back to OSRM for route');
      const osrmRoutes = await this.routeWithOSRM(origin, destination, mode, 0);
      if (osrmRoutes.length > 0) {
        return osrmRoutes[0];
      }
      throw new Error('No route found from OSRM');
    }

    const locations: ValhallaLocation[] = [
      this.toValhallaLocation(origin, 'break'),
      ...waypoints.map((wp) => this.toValhallaLocation(wp, 'through')),
      this.toValhallaLocation(destination, 'break'),
    ];

    const costing = this.getCostingProfile(mode);
    const costingOptions: Record<string, any> = {};

    if (options?.avoidHighways && costing === 'auto') {
      costingOptions.auto = { use_highways: 0.0 };
    }
    if (options?.avoidTolls && costing === 'auto') {
      costingOptions.auto = {
        ...costingOptions.auto,
        use_tolls: 0.0,
      };
    }

    const request: ValhallaRouteRequest = {
      locations,
      costing,
      costing_options: Object.keys(costingOptions).length > 0 ? costingOptions : undefined,
      directions_options: {
        units: 'kilometers',
        language: 'ru-RU',
      },
      alternates: options?.alternates,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<ValhallaRouteResponse>(
          `${this.baseUrl}/route`,
          request,
          { timeout: this.timeout },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Valhalla route error: ${error.message}`, error.stack);
      // Fallback to OSRM on error
      this.logger.warn('Falling back to OSRM due to Valhalla error');
      const osrmRoutes = await this.routeWithOSRM(origin, destination, mode, 0);
      if (osrmRoutes.length > 0) {
        return osrmRoutes[0];
      }
      throw error;
    }
  }

  // Построение маршрута с альтернативами
  async routeWithAlternatives(
    origin: Coordinates,
    destination: Coordinates,
    mode: TransportMode = TransportMode.CAR,
    numAlternatives: number = 2,
    options?: {
      avoidHighways?: boolean;
      avoidTolls?: boolean;
    },
  ): Promise<ValhallaRouteResponse[]> {
    // Check if Valhalla is available, fallback to OSRM if not
    const valhallaReady = await this.isValhallaAvailable();
    if (!valhallaReady) {
      this.logger.warn('Valhalla not available, falling back to OSRM');
      return this.routeWithOSRM(origin, destination, mode, numAlternatives);
    }

    const locations: ValhallaLocation[] = [
      this.toValhallaLocation(origin, 'break'),
      this.toValhallaLocation(destination, 'break'),
    ];

    const costing = this.getCostingProfile(mode);
    const costingOptions: Record<string, any> = {};

    if (options?.avoidHighways && costing === 'auto') {
      costingOptions.auto = { use_highways: 0.0 };
    }
    if (options?.avoidTolls && costing === 'auto') {
      costingOptions.auto = {
        ...costingOptions.auto,
        use_tolls: 0.0,
      };
    }

    const request: ValhallaRouteRequest = {
      locations,
      costing,
      costing_options: Object.keys(costingOptions).length > 0 ? costingOptions : undefined,
      directions_options: {
        units: 'kilometers',
        language: 'ru-RU',
      },
      alternates: numAlternatives,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          `${this.baseUrl}/route`,
          request,
          { timeout: this.timeout },
        ),
      );

      // Valhalla returns alternates in the response as separate trips
      const routes: ValhallaRouteResponse[] = [];

      // Main route
      if (response.data.trip) {
        routes.push({ trip: response.data.trip });
      }

      // Alternative routes (if any)
      if (response.data.alternates) {
        for (const alt of response.data.alternates) {
          if (alt.trip) {
            routes.push({ trip: alt.trip });
          }
        }
      }

      return routes;
    } catch (error) {
      this.logger.error(`Valhalla route with alternatives error: ${error.message}`, error.stack);
      // Fallback to OSRM on error
      this.logger.warn('Falling back to OSRM due to Valhalla error');
      return this.routeWithOSRM(origin, destination, mode, numAlternatives);
    }
  }

  // OSRM fallback routing
  private async routeWithOSRM(
    origin: Coordinates,
    destination: Coordinates,
    mode: TransportMode,
    numAlternatives: number,
  ): Promise<ValhallaRouteResponse[]> {
    const profile = mode === TransportMode.CAR ? 'driving' :
                    mode === TransportMode.BICYCLE ? 'cycling' : 'foot';

    // OSRM expects alternatives=true or a number (max alternatives to return)
    const alternativesParam = numAlternatives > 0 ? 'true' : 'false';
    const url = `${this.osrmBaseUrl}/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline6&alternatives=${alternativesParam}&steps=true`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(url, { timeout: this.timeout }),
      );

      if (response.data.code !== 'Ok' || !response.data.routes?.length) {
        throw new Error('OSRM returned no routes');
      }

      // Convert OSRM response to Valhalla-like format
      const routes = response.data.routes.map((osrmRoute: any) => this.convertOSRMToValhalla(osrmRoute));

      // If we need more alternatives, generate "scenic" routes via detour points
      if (numAlternatives >= 2 && routes.length < 3) {
        // Generate first scenic route (offset to one side)
        try {
          const scenicRoute1 = await this.generateScenicRoute(origin, destination, profile, 1);
          if (scenicRoute1) {
            routes.push(scenicRoute1);
          }
        } catch (e) {
          this.logger.warn(`Failed to generate scenic route 1: ${e.message}`);
        }

        // Generate second scenic route (offset to the other side) if still need more
        if (routes.length < 3) {
          try {
            const scenicRoute2 = await this.generateScenicRoute(origin, destination, profile, -1);
            if (scenicRoute2) {
              routes.push(scenicRoute2);
            }
          } catch (e) {
            this.logger.warn(`Failed to generate scenic route 2: ${e.message}`);
          }
        }
      }

      return routes;
    } catch (error) {
      this.logger.error(`OSRM route error: ${error.message}`);
      throw error;
    }
  }

  // Generate a scenic/alternative route by going through a detour point
  // direction: 1 = offset to one side, -1 = offset to the other side
  private async generateScenicRoute(
    origin: Coordinates,
    destination: Coordinates,
    profile: string,
    direction: number = 1,
  ): Promise<ValhallaRouteResponse | null> {
    // Calculate a detour point perpendicular to the direct route
    const midLat = (origin.latitude + destination.latitude) / 2;
    const midLng = (origin.longitude + destination.longitude) / 2;

    // Calculate perpendicular offset (rotate 90 degrees)
    const dLat = destination.latitude - origin.latitude;
    const dLng = destination.longitude - origin.longitude;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

    // Offset by ~30% of the direct distance, perpendicular to the route
    // direction controls which side of the route to offset
    const offsetFactor = 0.3 * direction;
    const perpLat = -dLng / distance * offsetFactor * distance;
    const perpLng = dLat / distance * offsetFactor * distance;

    // Create detour point (offset to one side based on direction)
    const detourPoint: Coordinates = {
      latitude: midLat + perpLat,
      longitude: midLng + perpLng,
    };

    const url = `${this.osrmBaseUrl}/route/v1/${profile}/${origin.longitude},${origin.latitude};${detourPoint.longitude},${detourPoint.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline6&steps=true`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(url, { timeout: this.timeout }),
      );

      if (response.data.code === 'Ok' && response.data.routes?.length > 0) {
        const side = direction > 0 ? 'left' : 'right';
        this.logger.log(`Generated scenic route via detour point (${side} side)`);
        return this.convertOSRMToValhalla(response.data.routes[0]);
      }
    } catch (e) {
      this.logger.warn(`Scenic route request failed: ${e.message}`);
    }

    return null;
  }

  // Convert OSRM response to Valhalla format
  private convertOSRMToValhalla(osrmRoute: any): ValhallaRouteResponse {
    // Collect all maneuvers from all legs
    const allManeuvers: any[] = [];
    let maneuverIndex = 0;
    for (const leg of osrmRoute.legs) {
      if (leg.steps) {
        for (const step of leg.steps) {
          allManeuvers.push({
            type: this.mapOSRMManeuverType(step.maneuver?.type),
            instruction: step.name || step.maneuver?.type || 'Continue',
            begin_shape_index: maneuverIndex,
            end_shape_index: maneuverIndex + 1,
            length: (step.distance || 0) / 1000,
            time: step.duration || 0,
            travel_mode: 'drive',
            travel_type: 'car',
          });
          maneuverIndex++;
        }
      }
    }

    // Create single leg with the full route geometry
    // OSRM's osrmRoute.geometry is the complete polyline for the entire route
    const singleLeg: ValhallaLeg = {
      maneuvers: allManeuvers,
      summary: {
        length: (osrmRoute.distance || 0) / 1000,
        time: osrmRoute.duration || 0,
      },
      shape: osrmRoute.geometry, // Full route polyline6 encoded
    };

    return {
      trip: {
        locations: [],
        legs: [singleLeg],
        summary: {
          length: (osrmRoute.distance || 0) / 1000, // meters to km
          time: osrmRoute.duration || 0,
          min_lat: 0,
          min_lon: 0,
          max_lat: 0,
          max_lon: 0,
        },
        status: 0,
        status_message: 'Found route',
        units: 'kilometers',
        language: 'en-US',
      },
    };
  }

  private mapOSRMManeuverType(osrmType: string): number {
    const mapping: Record<string, number> = {
      'depart': 1,
      'arrive': 4,
      'turn': 9,
      'continue': 7,
      'new name': 7,
      'slight right': 8,
      'right': 9,
      'sharp right': 10,
      'slight left': 15,
      'left': 14,
      'sharp left': 13,
      'uturn': 12,
    };
    return mapping[osrmType] || 7;
  }

  // Оптимизированный маршрут (TSP - порядок waypoints)
  async optimizedRoute(
    locations: Coordinates[],
    mode: TransportMode = TransportMode.CAR,
  ): Promise<ValhallaRouteResponse> {
    const valhallaLocations = locations.map((loc) =>
      this.toValhallaLocation(loc, 'break'),
    );

    const request: ValhallaOptimizedRouteRequest = {
      locations: valhallaLocations,
      costing: this.getCostingProfile(mode),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<ValhallaRouteResponse>(
          `${this.baseUrl}/optimized_route`,
          request,
          { timeout: this.timeout },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Valhalla optimized route error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Изохрона (область достижимости за время/расстояние)
  async isochrone(
    location: Coordinates,
    mode: TransportMode,
    contours: { timeMinutes?: number; distanceKm?: number }[],
  ): Promise<any> {
    const request: ValhallaIsochroneRequest = {
      locations: [this.toValhallaLocation(location)],
      costing: this.getCostingProfile(mode),
      contours: contours.map((c) => ({
        time: c.timeMinutes,
        distance: c.distanceKm,
      })),
      polygons: true,
      denoise: 0.5,
      generalize: 50,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(
          `${this.baseUrl}/isochrone`,
          request,
          { timeout: this.timeout },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Valhalla isochrone error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Матрица расстояний
  async matrix(
    sources: Coordinates[],
    targets: Coordinates[],
    mode: TransportMode = TransportMode.CAR,
  ): Promise<{ distances: number[][]; durations: number[][] }> {
    const request = {
      sources: sources.map((s) => this.toValhallaLocation(s)),
      targets: targets.map((t) => this.toValhallaLocation(t)),
      costing: this.getCostingProfile(mode),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/sources_to_targets`,
          request,
          { timeout: this.timeout },
        ),
      );

      // Преобразуем ответ Valhalla в удобный формат
      const data = response.data;
      const distances: number[][] = [];
      const durations: number[][] = [];

      for (let i = 0; i < sources.length; i++) {
        distances[i] = [];
        durations[i] = [];
        for (let j = 0; j < targets.length; j++) {
          const idx = i * targets.length + j;
          distances[i][j] = data.sources_to_targets[idx]?.distance || Infinity;
          durations[i][j] = data.sources_to_targets[idx]?.time || Infinity;
        }
      }

      return { distances, durations };
    } catch (error) {
      this.logger.error(`Valhalla matrix error: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Привязка точки к дороге
  async locate(
    location: Coordinates,
    mode: TransportMode = TransportMode.CAR,
  ): Promise<Coordinates | null> {
    const request = {
      locations: [this.toValhallaLocation(location)],
      costing: this.getCostingProfile(mode),
      verbose: true,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/locate`,
          request,
          { timeout: this.timeout },
        ),
      );

      const result = response.data[0];
      if (result && result.edges && result.edges.length > 0) {
        const edge = result.edges[0];
        return {
          latitude: edge.correlated_lat,
          longitude: edge.correlated_lon,
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Valhalla locate error: ${error.message}`, error.stack);
      return null;
    }
  }

  // Декодирование polyline из Valhalla (Google Polyline Algorithm)
  decodePolyline(encoded: string, precision: number = 6): Coordinates[] {
    const coordinates: Coordinates[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const factor = Math.pow(10, precision);

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      coordinates.push({
        latitude: lat / factor,
        longitude: lng / factor,
      });
    }

    return coordinates;
  }

  // Преобразование ответа Valhalla в GeoJSON LineString
  responseToGeoJSON(response: ValhallaRouteResponse): GeoJSONLineString {
    const allCoordinates: [number, number][] = [];

    for (const leg of response.trip.legs) {
      const decoded = this.decodePolyline(leg.shape);
      for (const coord of decoded) {
        allCoordinates.push([coord.longitude, coord.latitude]);
      }
    }

    return {
      type: 'LineString',
      coordinates: allCoordinates,
    };
  }

  // Проверка доступности Valhalla
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/status`, { timeout: 5000 }),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
