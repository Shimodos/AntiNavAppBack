"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POIModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const poi_controller_1 = require("./poi.controller");
const poi_service_1 = require("./poi.service");
const overpass_service_1 = require("./overpass.service");
const poi_cache_service_1 = require("./poi-cache.service");
const poi_entity_1 = require("./poi.entity");
let POIModule = class POIModule {
};
exports.POIModule = POIModule;
exports.POIModule = POIModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forFeature([poi_entity_1.POIEntity]),
        ],
        controllers: [poi_controller_1.POIController],
        providers: [
            poi_service_1.POIService,
            overpass_service_1.OverpassService,
            poi_cache_service_1.POICacheService,
        ],
        exports: [poi_service_1.POIService],
    })
], POIModule);
//# sourceMappingURL=poi.module.js.map