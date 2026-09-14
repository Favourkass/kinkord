import { Inject, Injectable } from "@nestjs/common";
import { Db, DRIZZLE } from "../db/db.module";
import { users } from "../db/schema";
//import { ne } from 'drizzle-orm';
import { inArray } from "drizzle-orm";

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: Db) {}
  async me(userId: string) {
    return this.db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
  }
  async byId(id: string) {
    return this.db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, id) });
  }
  async byIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db.select().from(users).where(inArray(users.id, ids));
  }
}
