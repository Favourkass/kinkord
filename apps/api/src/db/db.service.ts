import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

@Injectable()
export class DbService implements OnModuleInit {
  private readonly log = new Logger(DbService.name);
  public readonly pool: Pool;
  public readonly db: NodePgDatabase<typeof schema>;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit() {
    this.log.log('Running Drizzle migrations…');
    await migrate(this.db, { migrationsFolder: './drizzle' });
    this.log.log('Migrations complete.');
    if (process.env.NODE_ENV !== 'production') {
      await this.seedDevUsers();
    }
  }

  private async seedDevUsers() {
    const [{ count }] = (await this.db.execute(sql`select count(*)::int as count from users`)).rows as any[];
    if (count > 0) return;
    this.log.log('Seeding dev users…');
    await this.db.insert(schema.users).values([
      { username: 'alice', displayName: 'Alice' },
      { username: 'bob', displayName: 'Bob' },
      { username: 'carol', displayName: 'Carol' },
    ]);
  }
}