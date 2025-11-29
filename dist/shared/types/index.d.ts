export interface Coordinates {
    latitude: number;
    longitude: number;
}
export type LatLng = [number, number];
export interface POI {
    id: string;
    name: string;
    description?: string;
    coordinates: Coordinates;
    category: POICategory;
    subcategory?: string;
    rating?: number;
    ratingCount?: number;
    photos?: string[];
    openingHours?: OpeningHours;
    website?: string;
    phone?: string;
    address?: string;
    source: POISource;
    sourceId: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare enum POICategory {
    MUSEUM = "museum",
    GALLERY = "gallery",
    THEATER = "theater",
    MONUMENT = "monument",
    HISTORICAL = "historical",
    ARCHITECTURE = "architecture",
    PARK = "park",
    GARDEN = "garden",
    VIEWPOINT = "viewpoint",
    BEACH = "beach",
    LAKE = "lake",
    WATERFALL = "waterfall",
    MOUNTAIN = "mountain",
    FOREST = "forest",
    RESTAURANT = "restaurant",
    CAFE = "cafe",
    BAR = "bar",
    BAKERY = "bakery",
    STREET_FOOD = "street_food",
    ENTERTAINMENT = "entertainment",
    CINEMA = "cinema",
    AMUSEMENT_PARK = "amusement_park",
    ZOO = "zoo",
    AQUARIUM = "aquarium",
    HIKING_TRAIL = "hiking_trail",
    CYCLING = "cycling",
    WATER_SPORTS = "water_sports",
    CLIMBING = "climbing",
    MARKET = "market",
    SHOPPING = "shopping",
    SOUVENIR = "souvenir",
    RELIGIOUS = "religious",
    CEMETERY = "cemetery",
    OTHER = "other"
}
export declare enum POISource {
    OSM = "osm",
    WIKIDATA = "wikidata",
    FOURSQUARE = "foursquare",
    GOOGLE = "google",
    USER = "user"
}
export interface OpeningHours {
    monday?: DayHours;
    tuesday?: DayHours;
    wednesday?: DayHours;
    thursday?: DayHours;
    friday?: DayHours;
    saturday?: DayHours;
    sunday?: DayHours;
    holidays?: DayHours;
    raw?: string;
}
export interface DayHours {
    open: string;
    close: string;
    breaks?: {
        start: string;
        end: string;
    }[];
}
export interface Route {
    id: string;
    origin: Coordinates;
    destination: Coordinates;
    waypoints: Waypoint[];
    geometry: GeoJSONLineString;
    distance: number;
    duration: number;
    legs: RouteLeg[];
    settings: RouteSettings;
    createdAt: Date;
}
export interface Waypoint {
    coordinates: Coordinates;
    poi?: POI;
    type: 'origin' | 'destination' | 'poi' | 'custom';
    arrivalTime?: number;
}
export interface RouteLeg {
    startIndex: number;
    endIndex: number;
    distance: number;
    duration: number;
    geometry: GeoJSONLineString;
    maneuvers: Maneuver[];
}
export interface Maneuver {
    type: ManeuverType;
    instruction: string;
    coordinates: Coordinates;
    bearingBefore: number;
    bearingAfter: number;
    distance: number;
    duration: number;
}
export declare enum ManeuverType {
    DEPART = "depart",
    ARRIVE = "arrive",
    TURN_LEFT = "turn_left",
    TURN_RIGHT = "turn_right",
    TURN_SLIGHT_LEFT = "turn_slight_left",
    TURN_SLIGHT_RIGHT = "turn_slight_right",
    TURN_SHARP_LEFT = "turn_sharp_left",
    TURN_SHARP_RIGHT = "turn_sharp_right",
    CONTINUE = "continue",
    ROUNDABOUT = "roundabout",
    MERGE = "merge",
    FORK_LEFT = "fork_left",
    FORK_RIGHT = "fork_right",
    UTURN = "uturn"
}
export interface RouteSettings {
    adventureLevel: number;
    maxDistance?: number;
    maxDuration?: number;
    poiCategories: POICategory[];
    avoidHighways: boolean;
    avoidTolls: boolean;
    transportMode: TransportMode;
}
export declare enum TransportMode {
    CAR = "car",
    BICYCLE = "bicycle",
    PEDESTRIAN = "pedestrian"
}
export interface TrackingSettings {
    deviationRadius: number;
    notificationCooldown: number;
    maxDetourTime: number;
    enableNotifications: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
}
export interface POIRecommendation {
    poi: POI;
    detourDistance: number;
    detourDuration: number;
    relevanceScore: number;
    reason: string;
    alternativeRoute?: Route;
}
export interface User {
    id: string;
    email?: string;
    name?: string;
    preferences: UserPreferences;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserPreferences {
    favoriteCategories: POICategory[];
    avoidCategories: POICategory[];
    defaultTransportMode: TransportMode;
    defaultAdventureLevel: number;
    defaultDeviationRadius: number;
    language: string;
    units: 'metric' | 'imperial';
}
export interface GeoJSONLineString {
    type: 'LineString';
    coordinates: [number, number][];
}
export interface GeoJSONPolygon {
    type: 'Polygon';
    coordinates: [number, number][][];
}
export interface GeoJSONPoint {
    type: 'Point';
    coordinates: [number, number];
}
export interface CreateRouteRequest {
    origin: Coordinates;
    destination: Coordinates;
    settings: Partial<RouteSettings>;
}
export interface CreateRouteResponse {
    route: Route;
    alternativeRoutes?: Route[];
    poisOnRoute: POI[];
}
export interface GetRecommendationsRequest {
    currentLocation: Coordinates;
    routeId: string;
    settings?: Partial<TrackingSettings>;
}
export interface GetRecommendationsResponse {
    recommendations: POIRecommendation[];
}
export interface LocationUpdateEvent {
    type: 'location_update';
    payload: {
        coordinates: Coordinates;
        speed?: number;
        heading?: number;
        accuracy?: number;
        timestamp: number;
    };
}
export interface RecommendationEvent {
    type: 'recommendation';
    payload: POIRecommendation;
}
export interface RouteDeviationEvent {
    type: 'route_deviation';
    payload: {
        currentLocation: Coordinates;
        distanceFromRoute: number;
        nearestPointOnRoute: Coordinates;
    };
}
export type WebSocketEvent = LocationUpdateEvent | RecommendationEvent | RouteDeviationEvent;
