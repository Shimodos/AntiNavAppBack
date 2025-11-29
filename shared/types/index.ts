// Координаты
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LatLng = [number, number]; // [lat, lng]

// POI (Point of Interest)
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

export enum POICategory {
  // Культура
  MUSEUM = 'museum',
  GALLERY = 'gallery',
  THEATER = 'theater',
  MONUMENT = 'monument',
  HISTORICAL = 'historical',
  ARCHITECTURE = 'architecture',
  
  // Природа
  PARK = 'park',
  GARDEN = 'garden',
  VIEWPOINT = 'viewpoint',
  BEACH = 'beach',
  LAKE = 'lake',
  WATERFALL = 'waterfall',
  MOUNTAIN = 'mountain',
  FOREST = 'forest',
  
  // Еда и напитки
  RESTAURANT = 'restaurant',
  CAFE = 'cafe',
  BAR = 'bar',
  BAKERY = 'bakery',
  STREET_FOOD = 'street_food',
  
  // Развлечения
  ENTERTAINMENT = 'entertainment',
  CINEMA = 'cinema',
  AMUSEMENT_PARK = 'amusement_park',
  ZOO = 'zoo',
  AQUARIUM = 'aquarium',
  
  // Активности
  HIKING_TRAIL = 'hiking_trail',
  CYCLING = 'cycling',
  WATER_SPORTS = 'water_sports',
  CLIMBING = 'climbing',
  
  // Покупки
  MARKET = 'market',
  SHOPPING = 'shopping',
  SOUVENIR = 'souvenir',
  
  // Другое
  RELIGIOUS = 'religious',
  CEMETERY = 'cemetery',
  OTHER = 'other',
}

export enum POISource {
  OSM = 'osm',           // OpenStreetMap via Overpass
  WIKIDATA = 'wikidata',
  FOURSQUARE = 'foursquare',
  GOOGLE = 'google',
  USER = 'user',         // Добавлено пользователями
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
  raw?: string; // Оригинальная строка из источника
}

export interface DayHours {
  open: string;  // "09:00"
  close: string; // "18:00"
  breaks?: { start: string; end: string }[];
}

// Маршрут
export interface Route {
  id: string;
  origin: Coordinates;
  destination: Coordinates;
  waypoints: Waypoint[];
  geometry: GeoJSONLineString;
  distance: number;      // метры
  duration: number;      // секунды
  legs: RouteLeg[];
  settings: RouteSettings;
  createdAt: Date;
}

export interface Waypoint {
  coordinates: Coordinates;
  poi?: POI;
  type: 'origin' | 'destination' | 'poi' | 'custom';
  arrivalTime?: number;  // Estimated time from start in seconds
}

export interface RouteLeg {
  startIndex: number;    // Индекс waypoint
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
  distance: number;      // До следующего манёвра
  duration: number;
}

export enum ManeuverType {
  DEPART = 'depart',
  ARRIVE = 'arrive',
  TURN_LEFT = 'turn_left',
  TURN_RIGHT = 'turn_right',
  TURN_SLIGHT_LEFT = 'turn_slight_left',
  TURN_SLIGHT_RIGHT = 'turn_slight_right',
  TURN_SHARP_LEFT = 'turn_sharp_left',
  TURN_SHARP_RIGHT = 'turn_sharp_right',
  CONTINUE = 'continue',
  ROUNDABOUT = 'roundabout',
  MERGE = 'merge',
  FORK_LEFT = 'fork_left',
  FORK_RIGHT = 'fork_right',
  UTURN = 'uturn',
}

// Настройки маршрута
export interface RouteSettings {
  adventureLevel: number;        // 0-1, степень "приключения"
  maxDistance?: number;          // Макс длина в метрах
  maxDuration?: number;          // Макс время в секундах
  poiCategories: POICategory[];  // Интересующие категории
  avoidHighways: boolean;
  avoidTolls: boolean;
  transportMode: TransportMode;
}

export enum TransportMode {
  CAR = 'car',
  BICYCLE = 'bicycle',
  PEDESTRIAN = 'pedestrian',
}

// Настройки трекинга
export interface TrackingSettings {
  deviationRadius: number;       // Радиус поиска POI в метрах
  notificationCooldown: number;  // Мин. время между уведомлениями (секунды)
  maxDetourTime: number;         // Макс. доп. время на отклонение (секунды)
  enableNotifications: boolean;
  quietHoursStart?: string;      // "22:00"
  quietHoursEnd?: string;        // "08:00"
}

// Рекомендация POI в пути
export interface POIRecommendation {
  poi: POI;
  detourDistance: number;        // Доп. расстояние в метрах
  detourDuration: number;        // Доп. время в секундах
  relevanceScore: number;        // 0-1
  reason: string;                // "Популярный музей по пути"
  alternativeRoute?: Route;      // Маршрут с заездом
}

// Пользователь
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

// GeoJSON типы (упрощённые)
export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat][]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// API запросы/ответы
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

// WebSocket события
export interface LocationUpdateEvent {
  type: 'location_update';
  payload: {
    coordinates: Coordinates;
    speed?: number;        // м/с
    heading?: number;      // градусы
    accuracy?: number;     // метры
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

export type WebSocketEvent = 
  | LocationUpdateEvent 
  | RecommendationEvent 
  | RouteDeviationEvent;
