import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../db/db.module";

@Injectable()
export class HealthService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async check() {
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
