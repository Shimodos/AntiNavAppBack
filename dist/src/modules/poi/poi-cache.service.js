"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POICacheService = void 0;
const common_1 = require("@nestjs/common");
let POICacheService = class POICacheService {
    constructor() {
        this.cache = new Map();
    }
    async get(key) {
        return this.cache.get(key) || null;
    }
    async set(key, pois, ttl) {
        this.cache.set(key, pois);
    }
    async getByLocation(coords, radius) {
        const key = this.makeKey(coords, radius);
        return this.get(key);
    }
    async setByLocation(coords, radius, pois, ttl) {
        const key = this.makeKey(coords, radius);
        await this.set(key, pois, ttl);
    }
    makeKey(coords, radius) {
        const latRounded = Math.round(coords.latitude * 100) / 100;
        const lngRounded = Math.round(coords.longitude * 100) / 100;
        return `poi:${latRounded}:${lngRounded}:${radius}`;
    }
};
exports.POICacheService = POICacheService;
exports.POICacheService = POICacheService = __decorate([
    (0, common_1.Injectable)()
], POICacheService);
//# sourceMappingURL=poi-cache.service.js.map