import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { POIController } from './poi.controller';
import { POIService } from './poi.service';
import { OverpassService } from './overpass.service';
import { POICacheService } from './poi-cache.service';
import { POIEntity } from './poi.entity';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([POIEntity]),
  ],
  controllers: [POIController],
  providers: [
    POIService,
    OverpassService,
    POICacheService,
  ],
  exports: [POIService],
})
export class POIModule {}
