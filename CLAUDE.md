# Antinavigator Backend

Backend API for Antinavigator - navigation with interesting routes through POIs.

## Tech Stack

- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL + PostGIS
- **Cache**: Redis
- **Routing Engine**: Valhalla (self-hosted)
- **POI Sources**: OpenStreetMap (Overpass API)

## Project Structure

```
Backend/
├── src/
│   ├── config/           # Configuration
│   ├── modules/
│   │   ├── geo/          # Geographic utilities
│   │   ├── health/       # Health checks
│   │   ├── poi/          # Points of Interest
│   │   ├── recommendation/ # POI recommendations
│   │   ├── routing/      # Route generation
│   │   └── user/         # User management
│   ├── app.module.ts
│   └── main.ts
├── shared/               # Shared types, constants, utilities
│   ├── types/
│   ├── constants/
│   └── utils/
├── infrastructure/
│   └── docker/           # Docker Compose configs
├── docs/                 # Documentation
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Valhalla)
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Run in development mode
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start:prod
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/docs` - Swagger documentation

## Key Services

- **ValhallaService** - Integration with Valhalla routing engine
- **RouteGeneratorService** - Algorithm for generating interesting routes through POIs
- **OverpassService** - Loading POIs from OpenStreetMap
- **POIService** - POI management, caching, search

## Algorithm Overview

1. Get base (shortest) route via Valhalla
2. Build search "corridor" around origin → destination line
3. Find POIs in corridor via Overpass API
4. Score POIs by rating, uniqueness, proximity to route
5. Greedily select waypoints without exceeding maxDistance
6. Optimize order via Valhalla optimized_route
7. Build final route

See `docs/algorithms.md` for detailed description.

## Imports

Use `@shared` path alias for shared types and utilities:
```typescript
import { POI, Coordinates } from '@shared/types';
import { POI_CATEGORIES } from '@shared/constants';
```

## Code Conventions

- TypeScript strict mode
- Naming: camelCase for variables, PascalCase for types/classes
- NestJS modular architecture
- Coordinates format: `{ latitude, longitude }`, GeoJSON uses `[lng, lat]`
