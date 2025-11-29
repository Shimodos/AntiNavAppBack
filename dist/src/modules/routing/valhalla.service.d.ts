import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
    shape: string;
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
    contours: {
        time?: number;
        distance?: number;
    }[];
    polygons?: boolean;
    denoise?: number;
    generalize?: number;
}
export interface ValhallaOptimizedRouteRequest {
    locations: ValhallaLocation[];
    costing: string;
    costing_options?: Record<string, any>;
}
export declare class ValhallaService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly timeout;
    private readonly osrmBaseUrl;
    private valhallaAvailable;
    constructor(httpService: HttpService, configService: ConfigService);
    private isValhallaAvailable;
    private getCostingProfile;
    private toValhallaLocation;
    route(origin: Coordinates, destination: Coordinates, waypoints?: Coordinates[], mode?: TransportMode, options?: {
        avoidHighways?: boolean;
        avoidTolls?: boolean;
        alternates?: number;
    }): Promise<ValhallaRouteResponse>;
    routeWithAlternatives(origin: Coordinates, destination: Coordinates, mode?: TransportMode, numAlternatives?: number, options?: {
        avoidHighways?: boolean;
        avoidTolls?: boolean;
    }): Promise<ValhallaRouteResponse[]>;
    private routeWithOSRM;
    private generateScenicRoute;
    private convertOSRMToValhalla;
    private mapOSRMManeuverType;
    optimizedRoute(locations: Coordinates[], mode?: TransportMode): Promise<ValhallaRouteResponse>;
    isochrone(location: Coordinates, mode: TransportMode, contours: {
        timeMinutes?: number;
        distanceKm?: number;
    }[]): Promise<any>;
    matrix(sources: Coordinates[], targets: Coordinates[], mode?: TransportMode): Promise<{
        distances: number[][];
        durations: number[][];
    }>;
    locate(location: Coordinates, mode?: TransportMode): Promise<Coordinates | null>;
    decodePolyline(encoded: string, precision?: number): Coordinates[];
    responseToGeoJSON(response: ValhallaRouteResponse): GeoJSONLineString;
    healthCheck(): Promise<boolean>;
}
