import { POICategory, TransportMode, UserPreferences, RouteSettings, TrackingSettings } from '../types';

// Группы категорий для UI
export const POI_CATEGORY_GROUPS = {
  culture: {
    label: 'Культура',
    icon: 'museum',
    categories: [
      POICategory.MUSEUM,
      POICategory.GALLERY,
      POICategory.THEATER,
      POICategory.MONUMENT,
      POICategory.HISTORICAL,
      POICategory.ARCHITECTURE,
    ],
  },
  nature: {
    label: 'Природа',
    icon: 'tree',
    categories: [
      POICategory.PARK,
      POICategory.GARDEN,
      POICategory.VIEWPOINT,
      POICategory.BEACH,
      POICategory.LAKE,
      POICategory.WATERFALL,
      POICategory.MOUNTAIN,
      POICategory.FOREST,
    ],
  },
  food: {
    label: 'Еда и напитки',
    icon: 'utensils',
    categories: [
      POICategory.RESTAURANT,
      POICategory.CAFE,
      POICategory.BAR,
      POICategory.BAKERY,
      POICategory.STREET_FOOD,
    ],
  },
  entertainment: {
    label: 'Развлечения',
    icon: 'gamepad',
    categories: [
      POICategory.ENTERTAINMENT,
      POICategory.CINEMA,
      POICategory.AMUSEMENT_PARK,
      POICategory.ZOO,
      POICategory.AQUARIUM,
    ],
  },
  activities: {
    label: 'Активности',
    icon: 'hiking',
    categories: [
      POICategory.HIKING_TRAIL,
      POICategory.CYCLING,
      POICategory.WATER_SPORTS,
      POICategory.CLIMBING,
    ],
  },
  shopping: {
    label: 'Покупки',
    icon: 'shopping-bag',
    categories: [
      POICategory.MARKET,
      POICategory.SHOPPING,
      POICategory.SOUVENIR,
    ],
  },
} as const;

// Маппинг категорий на OSM теги для Overpass API
export const POI_CATEGORY_OSM_TAGS: Record<POICategory, string[]> = {
  [POICategory.MUSEUM]: ['tourism=museum'],
  [POICategory.GALLERY]: ['tourism=gallery', 'amenity=arts_centre'],
  [POICategory.THEATER]: ['amenity=theatre'],
  [POICategory.MONUMENT]: ['historic=monument', 'historic=memorial'],
  [POICategory.HISTORICAL]: ['historic=*'],
  [POICategory.ARCHITECTURE]: ['building=cathedral', 'building=church', 'tourism=attraction'],
  
  [POICategory.PARK]: ['leisure=park', 'leisure=nature_reserve'],
  [POICategory.GARDEN]: ['leisure=garden', 'tourism=garden'],
  [POICategory.VIEWPOINT]: ['tourism=viewpoint'],
  [POICategory.BEACH]: ['natural=beach'],
  [POICategory.LAKE]: ['natural=water', 'water=lake'],
  [POICategory.WATERFALL]: ['waterway=waterfall'],
  [POICategory.MOUNTAIN]: ['natural=peak'],
  [POICategory.FOREST]: ['natural=wood', 'landuse=forest'],
  
  [POICategory.RESTAURANT]: ['amenity=restaurant'],
  [POICategory.CAFE]: ['amenity=cafe'],
  [POICategory.BAR]: ['amenity=bar', 'amenity=pub'],
  [POICategory.BAKERY]: ['shop=bakery'],
  [POICategory.STREET_FOOD]: ['amenity=fast_food', 'shop=deli'],
  
  [POICategory.ENTERTAINMENT]: ['leisure=*'],
  [POICategory.CINEMA]: ['amenity=cinema'],
  [POICategory.AMUSEMENT_PARK]: ['tourism=theme_park', 'leisure=amusement_park'],
  [POICategory.ZOO]: ['tourism=zoo'],
  [POICategory.AQUARIUM]: ['tourism=aquarium'],
  
  [POICategory.HIKING_TRAIL]: ['route=hiking'],
  [POICategory.CYCLING]: ['route=bicycle', 'amenity=bicycle_rental'],
  [POICategory.WATER_SPORTS]: ['sport=swimming', 'sport=surfing', 'sport=diving'],
  [POICategory.CLIMBING]: ['sport=climbing'],
  
  [POICategory.MARKET]: ['amenity=marketplace', 'shop=market'],
  [POICategory.SHOPPING]: ['shop=mall', 'shop=department_store'],
  [POICategory.SOUVENIR]: ['shop=gift', 'shop=souvenir'],
  
  [POICategory.RELIGIOUS]: ['amenity=place_of_worship'],
  [POICategory.CEMETERY]: ['landuse=cemetery'],
  [POICategory.OTHER]: [],
};

// Дефолтные настройки
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  favoriteCategories: [
    POICategory.MUSEUM,
    POICategory.VIEWPOINT,
    POICategory.RESTAURANT,
    POICategory.PARK,
  ],
  avoidCategories: [],
  defaultTransportMode: TransportMode.CAR,
  defaultAdventureLevel: 0.5,
  defaultDeviationRadius: 1000, // 1 км
  language: 'ru',
  units: 'metric',
};

export const DEFAULT_ROUTE_SETTINGS: RouteSettings = {
  adventureLevel: 0.5,
  maxDistance: undefined,
  maxDuration: undefined,
  poiCategories: DEFAULT_USER_PREFERENCES.favoriteCategories,
  avoidHighways: false,
  avoidTolls: false,
  transportMode: TransportMode.CAR,
};

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  deviationRadius: 1000,           // 1 км
  notificationCooldown: 900,       // 15 минут
  maxDetourTime: 1800,             // 30 минут
  enableNotifications: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

// Лимиты и константы алгоритмов
export const ROUTING_CONSTANTS = {
  MIN_WAYPOINT_DISTANCE: 2000,     // Мин. расстояние между waypoints (метры)
  MAX_WAYPOINTS: 10,               // Макс. количество промежуточных точек
  CORRIDOR_BASE_WIDTH_FACTOR: 0.1, // Базовая ширина коридора как доля от длины маршрута
  CORRIDOR_MAX_WIDTH: 20000,       // Макс. ширина коридора (метры)
  POI_SEARCH_LIMIT: 100,           // Макс. POI для анализа
  GEOFENCE_RADIUS: 500,            // Радиус геофенса (метры)
  PRELOAD_DISTANCE: 20000,         // Расстояние предзагрузки POI (метры)
};

// Веса для скоринга POI
export const POI_SCORING_WEIGHTS = {
  rating: 0.25,
  uniqueness: 0.20,
  proximity: 0.25,
  clustering: 0.15,
  userPreference: 0.15,
};

// Веса для рекомендаций в пути
export const RECOMMENDATION_WEIGHTS = {
  relevance: 0.4,
  proximity: 0.3,
  rating: 0.2,
  timeFactor: 0.1,
};

// Временные факторы для рекомендаций
export const TIME_FACTORS: Partial<Record<POICategory, { peakHours: number[]; weight: number }>> = {
  [POICategory.RESTAURANT]: { peakHours: [12, 13, 19, 20], weight: 1.5 },
  [POICategory.CAFE]: { peakHours: [9, 10, 15, 16], weight: 1.3 },
  [POICategory.BAR]: { peakHours: [18, 19, 20, 21, 22], weight: 1.5 },
  [POICategory.MUSEUM]: { peakHours: [10, 11, 14, 15], weight: 1.2 },
  // Для остальных категорий вес = 1.0 (нейтральный)
};

// API endpoints (для клиента)
export const API_ENDPOINTS = {
  ROUTES: '/api/routes',
  ROUTE_BY_ID: (id: string) => `/api/routes/${id}`,
  RECOMMENDATIONS: '/api/recommendations',
  POI: '/api/poi',
  POI_BY_ID: (id: string) => `/api/poi/${id}`,
  POI_SEARCH: '/api/poi/search',
  USER_PREFERENCES: '/api/user/preferences',
  WEBSOCKET: '/ws',
};

// Valhalla costing options
export const VALHALLA_COSTING = {
  [TransportMode.CAR]: 'auto',
  [TransportMode.BICYCLE]: 'bicycle',
  [TransportMode.PEDESTRIAN]: 'pedestrian',
} as const;
