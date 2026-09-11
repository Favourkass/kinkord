import { Global, Module, OnApplicationShutdown } from "@nestjs/common";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DbService } from './db.service';
import * as schema from "./schema";

export const PG_POOL = Symbol("PG_POOL");
export const DRIZZLE = Symbol("DRIZZLE");

export type Db = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 10,
          // Fail fast instead of hanging: /health must answer within the
          // App Runner probe window even when the DB is unreachable.
          connectionTimeoutMillis: 3000,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
    },
    DbService
  ],
  exports: [PG_POOL, DRIZZLE, DbService],
})
export class DbModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown() {
    // Pool closed by process exit; explicit teardown added with the auth module.
  }
}



