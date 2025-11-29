import { Injectable } from '@nestjs/common';
import { POI, Coordinates } from '@shared';

@Injectable()
export class POICacheService {
  // TODO: Implement Redis caching
  private cache = new Map<string, POI[]>();

  async get(key: string): Promise<POI[] | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, pois: POI[], ttl?: number): Promise<void> {
    this.cache.set(key, pois);
  }

  async getByLocation(coords: Coordinates, radius: number): Promise<POI[] | null> {
    const key = this.makeKey(coords, radius);
    return this.get(key);
  }

  async setByLocation(coords: Coordinates, radius: number, pois: POI[], ttl?: number): Promise<void> {
    const key = this.makeKey(coords, radius);
    await this.set(key, pois, ttl);
  }

  private makeKey(coords: Coordinates, radius: number): string {
    const latRounded = Math.round(coords.latitude * 100) / 100;
    const lngRounded = Math.round(coords.longitude * 100) / 100;
    return `poi:${latRounded}:${lngRounded}:${radius}`;
  }
}
