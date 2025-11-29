import { POI, Coordinates } from '@shared';
export declare class POICacheService {
    private cache;
    get(key: string): Promise<POI[] | null>;
    set(key: string, pois: POI[], ttl?: number): Promise<void>;
    getByLocation(coords: Coordinates, radius: number): Promise<POI[] | null>;
    setByLocation(coords: Coordinates, radius: number, pois: POI[], ttl?: number): Promise<void>;
    private makeKey;
}
