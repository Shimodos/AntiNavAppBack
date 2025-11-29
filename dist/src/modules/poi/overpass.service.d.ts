import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Coordinates, POI, POICategory, BoundingBox } from '@shared';
interface OverpassElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    center?: {
        lat: number;
        lon: number;
    };
    tags?: Record<string, string>;
}
export declare class OverpassService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly fallbackUrls;
    private readonly timeout;
    private readonly retryAttempts;
    private readonly retryDelay;
    constructor(httpService: HttpService, configService: ConfigService);
    private delay;
    findPOIsInBoundingBox(bbox: BoundingBox, categories: POICategory[]): Promise<POI[]>;
    findPOIsInRadius(center: Coordinates, radiusMeters: number, categories: POICategory[]): Promise<POI[]>;
    private buildQuery;
    private buildRadiusQuery;
    private buildTagQueries;
    private executeQuery;
    private parseResponse;
    private detectCategory;
    private extractName;
    private extractSubcategory;
    private extractPhotos;
    private parseOpeningHours;
    private extractAddress;
    private extractTags;
    getPOIDetails(osmType: string, osmId: number): Promise<OverpassElement | null>;
}
export {};
