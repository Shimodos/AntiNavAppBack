import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { POIService } from './poi.service';
import { OverpassService } from './overpass.service';
import { POICategory } from '@shared';

@ApiTags('POI')
@Controller('api/poi')
export class POIController {
  constructor(
    private readonly poiService: POIService,
    private readonly overpassService: OverpassService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search POI in area' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  async search(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.poiService.searchNearby(
      { latitude: Number(lat), longitude: Number(lng) },
      radius ? Number(radius) : undefined,
    );
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby POIs' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  async getNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.poiService.searchNearby(
      { latitude: Number(lat), longitude: Number(lng) },
      radius ? Number(radius) : undefined,
    );
  }

  @Get('bbox')
  @ApiOperation({ summary: 'Get POIs in bounding box (visible map area)' })
  @ApiQuery({ name: 'minLat', type: Number })
  @ApiQuery({ name: 'maxLat', type: Number })
  @ApiQuery({ name: 'minLng', type: Number })
  @ApiQuery({ name: 'maxLng', type: Number })
  @ApiQuery({ name: 'categories', type: String, required: false, description: 'Comma-separated list of categories' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getByBbox(
    @Query('minLat') minLat: number,
    @Query('maxLat') maxLat: number,
    @Query('minLng') minLng: number,
    @Query('maxLng') maxLng: number,
    @Query('categories') categoriesStr?: string,
    @Query('limit') limit?: number,
  ) {
    const categories = categoriesStr
      ? categoriesStr.split(',').map(c => c.trim() as POICategory)
      : [];

    return this.poiService.findInBbox(
      {
        minLat: Number(minLat),
        maxLat: Number(maxLat),
        minLng: Number(minLng),
        maxLng: Number(maxLng),
      },
      categories,
      limit ? Number(limit) : 200,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get POI by ID' })
  async getById(@Param('id') id: string) {
    return this.poiService.getById(id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import POIs from OpenStreetMap for an area' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', example: 39.47 },
        lng: { type: 'number', example: -0.376 },
        radius: { type: 'number', example: 5000 },
        categories: {
          type: 'array',
          items: { type: 'string' },
          example: ['museum', 'restaurant', 'cafe', 'park', 'viewpoint', 'historical']
        }
      },
      required: ['lat', 'lng']
    }
  })
  async importFromOSM(
    @Body() body: { lat: number; lng: number; radius?: number; categories?: string[] }
  ) {
    const { lat, lng, radius = 5000, categories = ['museum', 'restaurant', 'cafe', 'park', 'viewpoint', 'historical'] } = body;

    const poiCategories = categories.map(c => c as POICategory);
    const center = { latitude: lat, longitude: lng };

    const pois = await this.overpassService.findPOIsInRadius(center, radius, poiCategories);

    // Save to database
    await this.poiService.savePOIs(pois);

    return {
      message: `Imported ${pois.length} POIs from OpenStreetMap`,
      count: pois.length,
      categories: categories
    };
  }
}
