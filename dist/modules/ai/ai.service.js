"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let AiService = class AiService {
    httpService;
    configService;
    aiServiceBaseUrl;
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.aiServiceBaseUrl = this.configService.get('AI_SERVICE_URL', 'http://localhost:8000/api/v1');
    }
    async checkFraud(transaction) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceBaseUrl}/fraud-detection/check`, transaction));
            return response.data;
        }
        catch (error) {
            console.error('Error calling fraud detection service:', error);
            throw new Error('AI service unavailable');
        }
    }
    async getOptimalRouting(transaction) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceBaseUrl}/payment-routing/analyze`, transaction));
            return response.data;
        }
        catch (error) {
            console.error('Error calling payment routing service:', error);
            throw new Error('AI service unavailable');
        }
    }
    async analyzePrices(currency) {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiServiceBaseUrl}/price-analysis/${currency}`));
            return response.data;
        }
        catch (error) {
            console.error('Error calling price analysis service:', error);
            throw new Error('AI service unavailable');
        }
    }
    async getHealthCheck() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiServiceBaseUrl}/health`));
            return response.data;
        }
        catch (error) {
            return { status: 'unhealthy' };
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map