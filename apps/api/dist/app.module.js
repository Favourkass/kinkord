"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("./auth/auth.module");
const db_module_1 = require("./db/db.module");
const email_module_1 = require("./email/email.module");
const health_controller_1 = require("./health/health.controller");
const health_service_1 = require("./health/health.service");
const messaging_module_1 = require("./messaging/messaging.module");
const profiles_module_1 = require("./profiles/profiles.module");
const storage_module_1 = require("./storage/storage.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            db_module_1.DbModule,
            email_module_1.EmailModule,
            auth_module_1.AuthModule,
            messaging_module_1.MessagingModule,
            storage_module_1.StorageModule,
            profiles_module_1.ProfilesModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [health_service_1.HealthService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map