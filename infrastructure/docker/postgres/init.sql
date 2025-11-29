-- Включаем расширения
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Для полнотекстового поиска
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица POI
CREATE TABLE IF NOT EXISTS pois (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255),
    source VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    rating DECIMAL(3, 2),
    rating_count INTEGER DEFAULT 0,
    photos TEXT[],
    opening_hours JSONB,
    website VARCHAR(500),
    phone VARCHAR(50),
    address TEXT,
    tags TEXT[],
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(source, external_id)
);

-- Индексы для POI
CREATE INDEX idx_pois_location ON pois USING GIST(location);
CREATE INDEX idx_pois_category ON pois(category);
CREATE INDEX idx_pois_source ON pois(source);
CREATE INDEX idx_pois_name_trgm ON pois USING GIN(name gin_trgm_ops);
CREATE INDEX idx_pois_tags ON pois USING GIN(tags);

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица сохранённых маршрутов
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    origin GEOGRAPHY(POINT, 4326) NOT NULL,
    destination GEOGRAPHY(POINT, 4326) NOT NULL,
    geometry GEOGRAPHY(LINESTRING, 4326),
    waypoints JSONB DEFAULT '[]',
    distance INTEGER, -- метры
    duration INTEGER, -- секунды
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routes_user ON routes(user_id);
CREATE INDEX idx_routes_origin ON routes USING GIST(origin);
CREATE INDEX idx_routes_destination ON routes USING GIST(destination);

-- Таблица истории посещений POI
CREATE TABLE IF NOT EXISTS poi_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    poi_id UUID REFERENCES pois(id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    
    UNIQUE(user_id, poi_id, visited_at)
);

CREATE INDEX idx_poi_visits_user ON poi_visits(user_id);
CREATE INDEX idx_poi_visits_poi ON poi_visits(poi_id);

-- Таблица показанных рекомендаций (чтобы не показывать повторно)
CREATE TABLE IF NOT EXISTS shown_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    poi_id UUID REFERENCES pois(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    shown_at TIMESTAMPTZ DEFAULT NOW(),
    action VARCHAR(50), -- 'dismissed', 'accepted', 'ignored'
    
    UNIQUE(user_id, poi_id, route_id)
);

CREATE INDEX idx_shown_recommendations_user_route ON shown_recommendations(user_id, route_id);

-- Функция обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автообновления updated_at
CREATE TRIGGER update_pois_updated_at
    BEFORE UPDATE ON pois
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Полезные функции для геозапросов

-- Поиск POI в радиусе
CREATE OR REPLACE FUNCTION find_pois_in_radius(
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_meters INTEGER,
    categories TEXT[] DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    poi_id UUID,
    poi_name VARCHAR,
    poi_category VARCHAR,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.category,
        ST_Distance(
            p.location,
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
        ) as dist
    FROM pois p
    WHERE ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
        radius_meters
    )
    AND (categories IS NULL OR p.category = ANY(categories))
    ORDER BY dist
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Поиск POI в полигоне (для коридора маршрута)
CREATE OR REPLACE FUNCTION find_pois_in_polygon(
    polygon_geojson TEXT,
    categories TEXT[] DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    poi_id UUID,
    poi_name VARCHAR,
    poi_category VARCHAR,
    poi_rating DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.category,
        p.rating
    FROM pois p
    WHERE ST_Within(
        p.location::geometry,
        ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)
    )
    AND (categories IS NULL OR p.category = ANY(categories))
    ORDER BY p.rating DESC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Кластеризация POI (для UI)
CREATE OR REPLACE FUNCTION cluster_pois(
    bounds_geojson TEXT,
    cluster_distance_meters INTEGER DEFAULT 100
)
RETURNS TABLE (
    cluster_center GEOGRAPHY,
    poi_count BIGINT,
    categories TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH pois_in_bounds AS (
        SELECT p.id, p.location, p.category
        FROM pois p
        WHERE ST_Within(
            p.location::geometry,
            ST_SetSRID(ST_GeomFromGeoJSON(bounds_geojson), 4326)
        )
    ),
    clustered AS (
        SELECT 
            ST_ClusterDBSCAN(location::geometry, eps := cluster_distance_meters, minpoints := 1) OVER() as cluster_id,
            location,
            category
        FROM pois_in_bounds
    )
    SELECT 
        ST_Centroid(ST_Collect(location::geometry))::geography as center,
        COUNT(*) as cnt,
        array_agg(DISTINCT category) as cats
    FROM clustered
    GROUP BY cluster_id;
END;
$$ LANGUAGE plpgsql;
