import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { AppModule } from "./app.module";
import { AUTH, Auth } from "./auth/auth.instance";

/** Applies pending Drizzle migrations before serving (idempotent; used in
 *  deployed environments so CI never needs database network access). */
async function migrateOnBoot() {
  if (process.env.RUN_MIGRATIONS !== "true") return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    // eslint-disable-next-line no-console
    console.log("migrations: up to date");
  } finally {
    await pool.end();
  }
}

async function bootstrap() {
  await migrateOnBoot();
  // Body parsing is disabled globally: Better Auth consumes the raw request
  // for /api/auth/*; JSON parsing is applied to every other route below.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const origins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const express = app.getHttpAdapter().getInstance();
  const authHandler = toNodeHandler(app.get<Auth>(AUTH));

  express.use(cors({ origin: origins, credentials: true }));
  express.use((req, res, next) => {
    if (req.url.startsWith("/api/auth")) return void authHandler(req, res);
    next();
  });
  express.use(json({ limit: "1mb" }));
  express.use(urlencoded({ extended: true }));

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`kinkord api listening on :${port}`);
}

void bootstrap();
