declare const _default: () => {
    port: number;
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        name: string;
        synchronize: boolean;
        logging: boolean;
    };
    redis: {
        host: string;
        port: number;
    };
    valhalla: {
        url: string;
        timeout: number;
    };
    overpass: {
        url: string;
        timeout: number;
        fallbackUrls: string[];
        retryAttempts: number;
        retryDelay: number;
    };
    poi: {
        cacheTTL: number;
        maxSearchRadius: number;
        defaultSearchRadius: number;
    };
    routing: {
        maxWaypoints: number;
        maxRouteDistance: number;
        corridorWidthFactor: number;
    };
    recommendation: {
        cooldownSeconds: number;
        maxDetourMeters: number;
        preloadDistanceMeters: number;
    };
};
export default _default;
