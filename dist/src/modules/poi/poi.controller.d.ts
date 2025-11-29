import { POIService } from './poi.service';
import { OverpassService } from './overpass.service';
export declare class POIController {
    private readonly poiService;
    private readonly overpassService;
    constructor(poiService: POIService, overpassService: OverpassService);
    search(lat: number, lng: number, radius?: number): Promise<import("@shared").POI[]>;
    getNearby(lat: number, lng: number, radius?: number): Promise<import("@shared").POI[]>;
    getByBbox(minLat: number, maxLat: number, minLng: number, maxLng: number, categoriesStr?: string, limit?: number): Promise<import("@shared").POI[]>;
    getById(id: string): Promise<import("@shared").POI | null>;
    importFromOSM(body: {
        lat: number;
        lng: number;
        radius?: number;
        categories?: string[];
    }): Promise<{
        message: string;
        count: number;
        categories: string[];
    }>;
}
