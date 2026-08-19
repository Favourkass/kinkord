import { Controller, Get, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

@Controller()
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get("health")
  async health() {
    let db = "down";
    try {
      await this.pool.query("SELECT 1");
      db = "up";
    } catch {
      // db stays "down"; the endpoint itself still answers
    }
    return { ok: true, db, ts: new Date().toISOString() };
  }
}
