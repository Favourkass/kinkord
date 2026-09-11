import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import { ne } from 'drizzle-orm';

@Injectable()
export class UsersService {
  constructor(private db: DbService) {}
  async me(userId: string) {
    return this.db.db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
  }
  async listOthers(userId: string) {
    return this.db.db.select().from(users).where(ne(users.id, userId));
  }
  async byId(id: string) {
    return this.db.db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, id) });
  }
  async byIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db.db.select().from(users).where((u, { inArray }) => inArray(u.id, ids));
  }
}