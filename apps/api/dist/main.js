"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const express_1 = require("express");
const cors_1 = __importDefault(require("cors"));
const node_1 = require("better-auth/node");
const app_module_1 = require("./app.module");
const auth_instance_1 = require("./auth/auth.instance");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bodyParser: false,
    });
    const origins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    const express = app.getHttpAdapter().getInstance();
    const authHandler = (0, node_1.toNodeHandler)(app.get(auth_instance_1.AUTH));
    express.use((0, cors_1.default)({ origin: origins, credentials: true }));
    express.use((req, res, next) => {
        if (req.url.startsWith("/api/auth"))
            return void authHandler(req, res);
        next();
    });
    express.use((0, express_1.json)({ limit: "1mb" }));
    express.use((0, express_1.urlencoded)({ extended: true }));
    app.enableShutdownHooks();
    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port, "0.0.0.0");
    console.log(`kinkord api listening on :${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map