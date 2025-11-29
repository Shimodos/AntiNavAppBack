import { POICategory, UserPreferences, RouteSettings, TrackingSettings } from '../types';
export declare const POI_CATEGORY_GROUPS: {
    readonly culture: {
        readonly label: "Культура";
        readonly icon: "museum";
        readonly categories: readonly [POICategory.MUSEUM, POICategory.GALLERY, POICategory.THEATER, POICategory.MONUMENT, POICategory.HISTORICAL, POICategory.ARCHITECTURE];
    };
    readonly nature: {
        readonly label: "Природа";
        readonly icon: "tree";
        readonly categories: readonly [POICategory.PARK, POICategory.GARDEN, POICategory.VIEWPOINT, POICategory.BEACH, POICategory.LAKE, POICategory.WATERFALL, POICategory.MOUNTAIN, POICategory.FOREST];
    };
    readonly food: {
        readonly label: "Еда и напитки";
        readonly icon: "utensils";
        readonly categories: readonly [POICategory.RESTAURANT, POICategory.CAFE, POICategory.BAR, POICategory.BAKERY, POICategory.STREET_FOOD];
    };
    readonly entertainment: {
        readonly label: "Развлечения";
        readonly icon: "gamepad";
        readonly categories: readonly [POICategory.ENTERTAINMENT, POICategory.CINEMA, POICategory.AMUSEMENT_PARK, POICategory.ZOO, POICategory.AQUARIUM];
    };
    readonly activities: {
        readonly label: "Активности";
        readonly icon: "hiking";
        readonly categories: readonly [POICategory.HIKING_TRAIL, POICategory.CYCLING, POICategory.WATER_SPORTS, POICategory.CLIMBING];
    };
    readonly shopping: {
        readonly label: "Покупки";
        readonly icon: "shopping-bag";
        readonly categories: readonly [POICategory.MARKET, POICategory.SHOPPING, POICategory.SOUVENIR];
    };
};
export declare const POI_CATEGORY_OSM_TAGS: Record<POICategory, string[]>;
export declare const DEFAULT_USER_PREFERENCES: UserPreferences;
export declare const DEFAULT_ROUTE_SETTINGS: RouteSettings;
export declare const DEFAULT_TRACKING_SETTINGS: TrackingSettings;
export declare const ROUTING_CONSTANTS: {
    MIN_WAYPOINT_DISTANCE: number;
    MAX_WAYPOINTS: number;
    CORRIDOR_BASE_WIDTH_FACTOR: number;
    CORRIDOR_MAX_WIDTH: number;
    POI_SEARCH_LIMIT: number;
    GEOFENCE_RADIUS: number;
    PRELOAD_DISTANCE: number;
};
export declare const POI_SCORING_WEIGHTS: {
    rating: number;
    uniqueness: number;
    proximity: number;
    clustering: number;
    userPreference: number;
};
export declare const RECOMMENDATION_WEIGHTS: {
    relevance: number;
    proximity: number;
    rating: number;
    timeFactor: number;
};
export declare const TIME_FACTORS: Partial<Record<POICategory, {
    peakHours: number[];
    weight: number;
}>>;
export declare const API_ENDPOINTS: {
    ROUTES: string;
    ROUTE_BY_ID: (id: string) => string;
    RECOMMENDATIONS: string;
    POI: string;
    POI_BY_ID: (id: string) => string;
    POI_SEARCH: string;
    USER_PREFERENCES: string;
    WEBSOCKET: string;
};
export declare const VALHALLA_COSTING: {
    readonly car: "auto";
    readonly bicycle: "bicycle";
    readonly pedestrian: "pedestrian";
};
