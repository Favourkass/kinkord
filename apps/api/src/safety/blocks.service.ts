import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { memberBlock, user } from "../db/schema";

/** A member's own blocks: who they won't hear from. */
@Injectable()
export class BlocksService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** Stops the pair messaging each other, both ways. Blocking twice is the same as once. */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) throw new BadRequestException("You can't block yourself.");
    const [target] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, blockedId))
      .limit(1);
    if (!target) throw new NotFoundException("Member not found.");
    await this.db.insert(memberBlock).values({ blockerId, blockedId }).onConflictDoNothing();
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.db
      .delete(memberBlock)
      .where(and(eq(memberBlock.blockerId, blockerId), eq(memberBlock.blockedId, blockedId)));
  }
}
