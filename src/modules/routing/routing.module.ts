import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ValhallaService } from './valhalla.service';
import { RouteGeneratorService } from './route-generator.service';
import { POIModule } from '../poi/poi.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    POIModule,
  ],
  controllers: [RoutingController],
  providers: [
    RoutingService,
    ValhallaService,
    RouteGeneratorService,
  ],
  exports: [RoutingService, ValhallaService],
})
export class RoutingModule {}
