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

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('valhalla.url') ?? 'http://localhost:8002';
    this.timeout = this.configService.get<number>('valhalla.timeout') ?? 30000;
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
    },
  ): Promise<ValhallaRouteResponse> {
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
      throw error;
    }
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
