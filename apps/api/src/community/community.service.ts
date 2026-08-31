import { Inject, Injectable } from "@nestjs/common";
import { count } from "drizzle-orm";
import { Db, DRIZZLE } from "../db/db.module";
import { user } from "../db/schema";

@Injectable()
export class CommunityService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async stats() {
    const [row] = await this.db.select({ members: count() }).from(user);
    return { members: row?.members ?? 0 };
  }
}
