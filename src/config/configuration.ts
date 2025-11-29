export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    username: process.env.DB_USERNAME || 'wanderer',
    password: process.env.DB_PASSWORD || 'wanderer_dev_password',
    name: process.env.DB_NAME || 'wanderer',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  valhalla: {
    url: process.env.VALHALLA_URL || 'http://localhost:8002',
    timeout: parseInt(process.env.VALHALLA_TIMEOUT ?? '30000', 10),
  },

  overpass: {
    url: process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
    timeout: parseInt(process.env.OVERPASS_TIMEOUT ?? '30000', 10), // Reduced to 30s
    fallbackUrls: [
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
    ],
    retryAttempts: 2, // Retry each server up to 2 times
    retryDelay: 1000, // 1 second between retries
  },

  poi: {
    cacheTTL: parseInt(process.env.POI_CACHE_TTL ?? '86400', 10),
    maxSearchRadius: parseInt(process.env.POI_MAX_SEARCH_RADIUS ?? '50000', 10),
    defaultSearchRadius: parseInt(process.env.POI_DEFAULT_SEARCH_RADIUS ?? '5000', 10),
  },

  routing: {
    maxWaypoints: parseInt(process.env.ROUTING_MAX_WAYPOINTS ?? '10', 10),
    maxRouteDistance: parseInt(process.env.ROUTING_MAX_DISTANCE ?? '1000000', 10),
    corridorWidthFactor: parseFloat(process.env.ROUTING_CORRIDOR_WIDTH_FACTOR ?? '0.1'),
  },

  recommendation: {
    cooldownSeconds: parseInt(process.env.RECOMMENDATION_COOLDOWN ?? '900', 10),
    maxDetourMeters: parseInt(process.env.RECOMMENDATION_MAX_DETOUR ?? '5000', 10),
    preloadDistanceMeters: parseInt(process.env.RECOMMENDATION_PRELOAD_DISTANCE ?? '20000', 10),
  },
});
