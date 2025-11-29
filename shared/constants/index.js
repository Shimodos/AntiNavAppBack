"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALHALLA_COSTING = exports.API_ENDPOINTS = exports.TIME_FACTORS = exports.RECOMMENDATION_WEIGHTS = exports.POI_SCORING_WEIGHTS = exports.ROUTING_CONSTANTS = exports.DEFAULT_TRACKING_SETTINGS = exports.DEFAULT_ROUTE_SETTINGS = exports.DEFAULT_USER_PREFERENCES = exports.POI_CATEGORY_OSM_TAGS = exports.POI_CATEGORY_GROUPS = void 0;
const types_1 = require("../types");
exports.POI_CATEGORY_GROUPS = {
    culture: {
        label: 'Культура',
        icon: 'museum',
        categories: [
            types_1.POICategory.MUSEUM,
            types_1.POICategory.GALLERY,
            types_1.POICategory.THEATER,
            types_1.POICategory.MONUMENT,
            types_1.POICategory.HISTORICAL,
            types_1.POICategory.ARCHITECTURE,
        ],
    },
    nature: {
        label: 'Природа',
        icon: 'tree',
        categories: [
            types_1.POICategory.PARK,
            types_1.POICategory.GARDEN,
            types_1.POICategory.VIEWPOINT,
            types_1.POICategory.BEACH,
            types_1.POICategory.LAKE,
            types_1.POICategory.WATERFALL,
            types_1.POICategory.MOUNTAIN,
            types_1.POICategory.FOREST,
        ],
    },
    food: {
        label: 'Еда и напитки',
        icon: 'utensils',
        categories: [
            types_1.POICategory.RESTAURANT,
            types_1.POICategory.CAFE,
            types_1.POICategory.BAR,
            types_1.POICategory.BAKERY,
            types_1.POICategory.STREET_FOOD,
        ],
    },
    entertainment: {
        label: 'Развлечения',
        icon: 'gamepad',
        categories: [
            types_1.POICategory.ENTERTAINMENT,
            types_1.POICategory.CINEMA,
            types_1.POICategory.AMUSEMENT_PARK,
            types_1.POICategory.ZOO,
            types_1.POICategory.AQUARIUM,
        ],
    },
    activities: {
        label: 'Активности',
        icon: 'hiking',
        categories: [
            types_1.POICategory.HIKING_TRAIL,
            types_1.POICategory.CYCLING,
            types_1.POICategory.WATER_SPORTS,
            types_1.POICategory.CLIMBING,
        ],
    },
    shopping: {
        label: 'Покупки',
        icon: 'shopping-bag',
        categories: [
            types_1.POICategory.MARKET,
            types_1.POICategory.SHOPPING,
            types_1.POICategory.SOUVENIR,
        ],
    },
};
exports.POI_CATEGORY_OSM_TAGS = {
    [types_1.POICategory.MUSEUM]: ['tourism=museum'],
    [types_1.POICategory.GALLERY]: ['tourism=gallery', 'amenity=arts_centre'],
    [types_1.POICategory.THEATER]: ['amenity=theatre'],
    [types_1.POICategory.MONUMENT]: ['historic=monument', 'historic=memorial'],
    [types_1.POICategory.HISTORICAL]: ['historic=*'],
    [types_1.POICategory.ARCHITECTURE]: ['building=cathedral', 'building=church', 'tourism=attraction'],
    [types_1.POICategory.PARK]: ['leisure=park', 'leisure=nature_reserve'],
    [types_1.POICategory.GARDEN]: ['leisure=garden', 'tourism=garden'],
    [types_1.POICategory.VIEWPOINT]: ['tourism=viewpoint'],
    [types_1.POICategory.BEACH]: ['natural=beach'],
    [types_1.POICategory.LAKE]: ['natural=water', 'water=lake'],
    [types_1.POICategory.WATERFALL]: ['waterway=waterfall'],
    [types_1.POICategory.MOUNTAIN]: ['natural=peak'],
    [types_1.POICategory.FOREST]: ['natural=wood', 'landuse=forest'],
    [types_1.POICategory.RESTAURANT]: ['amenity=restaurant'],
    [types_1.POICategory.CAFE]: ['amenity=cafe'],
    [types_1.POICategory.BAR]: ['amenity=bar', 'amenity=pub'],
    [types_1.POICategory.BAKERY]: ['shop=bakery'],
    [types_1.POICategory.STREET_FOOD]: ['amenity=fast_food', 'shop=deli'],
    [types_1.POICategory.ENTERTAINMENT]: ['leisure=*'],
    [types_1.POICategory.CINEMA]: ['amenity=cinema'],
    [types_1.POICategory.AMUSEMENT_PARK]: ['tourism=theme_park', 'leisure=amusement_park'],
    [types_1.POICategory.ZOO]: ['tourism=zoo'],
    [types_1.POICategory.AQUARIUM]: ['tourism=aquarium'],
    [types_1.POICategory.HIKING_TRAIL]: ['route=hiking'],
    [types_1.POICategory.CYCLING]: ['route=bicycle', 'amenity=bicycle_rental'],
    [types_1.POICategory.WATER_SPORTS]: ['sport=swimming', 'sport=surfing', 'sport=diving'],
    [types_1.POICategory.CLIMBING]: ['sport=climbing'],
    [types_1.POICategory.MARKET]: ['amenity=marketplace', 'shop=market'],
    [types_1.POICategory.SHOPPING]: ['shop=mall', 'shop=department_store'],
    [types_1.POICategory.SOUVENIR]: ['shop=gift', 'shop=souvenir'],
    [types_1.POICategory.RELIGIOUS]: ['amenity=place_of_worship'],
    [types_1.POICategory.CEMETERY]: ['landuse=cemetery'],
    [types_1.POICategory.OTHER]: [],
};
exports.DEFAULT_USER_PREFERENCES = {
    favoriteCategories: [
        types_1.POICategory.MUSEUM,
        types_1.POICategory.VIEWPOINT,
        types_1.POICategory.RESTAURANT,
        types_1.POICategory.PARK,
    ],
    avoidCategories: [],
    defaultTransportMode: types_1.TransportMode.CAR,
    defaultAdventureLevel: 0.5,
    defaultDeviationRadius: 1000,
    language: 'ru',
    units: 'metric',
};
exports.DEFAULT_ROUTE_SETTINGS = {
    adventureLevel: 0.5,
    maxDistance: undefined,
    maxDuration: undefined,
    poiCategories: exports.DEFAULT_USER_PREFERENCES.favoriteCategories,
    avoidHighways: false,
    avoidTolls: false,
    transportMode: types_1.TransportMode.CAR,
};
exports.DEFAULT_TRACKING_SETTINGS = {
    deviationRadius: 1000,
    notificationCooldown: 900,
    maxDetourTime: 1800,
    enableNotifications: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
};
exports.ROUTING_CONSTANTS = {
    MIN_WAYPOINT_DISTANCE: 2000,
    MAX_WAYPOINTS: 10,
    CORRIDOR_BASE_WIDTH_FACTOR: 0.1,
    CORRIDOR_MAX_WIDTH: 20000,
    POI_SEARCH_LIMIT: 100,
    GEOFENCE_RADIUS: 500,
    PRELOAD_DISTANCE: 20000,
};
exports.POI_SCORING_WEIGHTS = {
    rating: 0.25,
    uniqueness: 0.20,
    proximity: 0.25,
    clustering: 0.15,
    userPreference: 0.15,
};
exports.RECOMMENDATION_WEIGHTS = {
    relevance: 0.4,
    proximity: 0.3,
    rating: 0.2,
    timeFactor: 0.1,
};
exports.TIME_FACTORS = {
    [types_1.POICategory.RESTAURANT]: { peakHours: [12, 13, 19, 20], weight: 1.5 },
    [types_1.POICategory.CAFE]: { peakHours: [9, 10, 15, 16], weight: 1.3 },
    [types_1.POICategory.BAR]: { peakHours: [18, 19, 20, 21, 22], weight: 1.5 },
    [types_1.POICategory.MUSEUM]: { peakHours: [10, 11, 14, 15], weight: 1.2 },
};
exports.API_ENDPOINTS = {
    ROUTES: '/api/routes',
    ROUTE_BY_ID: (id) => `/api/routes/${id}`,
    RECOMMENDATIONS: '/api/recommendations',
    POI: '/api/poi',
    POI_BY_ID: (id) => `/api/poi/${id}`,
    POI_SEARCH: '/api/poi/search',
    USER_PREFERENCES: '/api/user/preferences',
    WEBSOCKET: '/ws',
};
exports.VALHALLA_COSTING = {
    [types_1.TransportMode.CAR]: 'auto',
    [types_1.TransportMode.BICYCLE]: 'bicycle',
    [types_1.TransportMode.PEDESTRIAN]: 'pedestrian',
};
//# sourceMappingURL=index.js.map