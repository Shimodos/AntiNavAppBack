import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoutingService } from './routing.service';
import { CreateRouteRequest } from '@shared';

@ApiTags('Routing')
@Controller('api/routes')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new route with interesting POIs' })
  async createRoute(@Body() request: CreateRouteRequest) {
    return this.routingService.createRoute(request);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get route by ID' })
  async getRoute(@Param('id') id: string) {
    return this.routingService.getRouteById(id);
  }
}
