import { Global, Module, OnApplicationShutdown } from "@nestjs/common";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
    },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DbModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown() {
    // Pool closed by process exit; explicit teardown added with the auth module.
  }
}
