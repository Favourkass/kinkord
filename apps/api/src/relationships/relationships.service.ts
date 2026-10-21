import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, eq, ne, or } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { memberRelationship, profile, user } from "../db/schema";
import { orderedPair } from "../members/friendship-policy";
import { notBanned } from "../moderation/admins";
import { PushService } from "../push/push.service";
import { noBlockEitherWay } from "../safety/blocks";
import { StorageService } from "../storage/storage.service";
import { relationshipRows, type RelationshipItem } from "./profile-relationships";
import { relationshipKind, relationshipOptions } from "./relationship-types";

/** Requests one member can have waiting at once: plenty for real links, few for spam. */
export const MAX_PENDING_REQUESTS = 20;

export interface RelationshipsList {
  /** Accepted links. */
  links: RelationshipItem[];
  /** Requests waiting for this member's answer. */
  incoming: RelationshipItem[];
  /** Requests this member sent that are still waiting. */
  outgoing: RelationshipItem[];
}

/**
 * Linked relationships, FetLife-style (founder, 2026-10-21). In a D/s link the
 * submissive asks and the dominant accepts; any other relationship either
 * member asks for and the other accepts. Either member ends a link, or drops
 * a request, at any time, and nobody is told: ending one shouldn't send a push.
 */
@Injectable()
export class RelationshipsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly push: PushService,
    private readonly storage: StorageService,
  ) {}

  options() {
    return relationshipOptions();
  }

  async list(viewerId: string): Promise<RelationshipsList> {
    const rows = await relationshipRows(this.db, this.storage, viewerId, viewerId);
    const waiting = rows.filter((r) => !r.acceptedAt);
    return {
      links: rows.filter((r) => r.acceptedAt),
      incoming: waiting.filter((r) => r.requestedBy === "other"),
      outgoing: waiting.filter((r) => r.requestedBy === "self"),
    };
  }

  /**
   * Asks `username` to link. In a D/s link the asker is the submissive and
   * `type` names the dominant's role, so a dominant can't put someone down as
   * their submissive: the submissive has to ask.
   */
  async request(viewerId: string, username: string, type: string): Promise<RelationshipsList> {
    const kind = relationshipKind(type);
    if (!kind) throw new BadRequestException("Choose a relationship.");
    const handle = username.replace(/^@/, "").toLowerCase();
    const targetId = await this.target(viewerId, handle);
    const [waiting] = await this.db
      .select({ n: count() })
      .from(memberRelationship)
      .where(
        and(eq(memberRelationship.requesterId, viewerId), eq(memberRelationship.status, "pending")),
      );
    if (Number(waiting?.n ?? 0) >= MAX_PENDING_REQUESTS) {
      throw new HttpException(
        `You have ${MAX_PENDING_REQUESTS} requests waiting. Wait for some answers first.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const [added] = await this.db
      .insert(memberRelationship)
      .values({ ...orderedPair(viewerId, targetId), requesterId: viewerId, kind, type })
      .onConflictDoNothing()
      .returning({ id: memberRelationship.id });
    if (!added) {
      throw new ConflictException(
        kind === "ds"
          ? `You and @${handle} already have a D/s link, or a request waiting.`
          : `You and @${handle} already have a relationship link, or a request waiting.`,
      );
    }
    this.push.relationshipRequest(viewerId, targetId, added.id);
    return this.list(viewerId);
  }

  /** Only the member who was asked can accept. */
  async accept(viewerId: string, id: string): Promise<RelationshipsList> {
    const [accepted] = await this.db
      .update(memberRelationship)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(
        and(
          eq(memberRelationship.id, id),
          eq(memberRelationship.status, "pending"),
          ne(memberRelationship.requesterId, viewerId),
          or(eq(memberRelationship.userA, viewerId), eq(memberRelationship.userB, viewerId)),
        ),
      )
      .returning({ requesterId: memberRelationship.requesterId });
    if (!accepted) throw new NotFoundException("This request is no longer waiting.");
    this.push.relationshipAccepted(viewerId, accepted.requesterId, id);
    return this.list(viewerId);
  }

  /** Declines or cancels a request, or ends a link: either member, without telling the other. */
  async remove(viewerId: string, id: string): Promise<RelationshipsList> {
    const removed = await this.db
      .delete(memberRelationship)
      .where(
        and(
          eq(memberRelationship.id, id),
          or(eq(memberRelationship.userA, viewerId), eq(memberRelationship.userB, viewerId)),
        ),
      )
      .returning({ id: memberRelationship.id });
    if (!removed.length) throw new NotFoundException("That link is already gone.");
    return this.list(viewerId);
  }

  private async target(viewerId: string, handle: string): Promise<string> {
    const [row] = await this.db
      .select({ id: user.id, accountType: profile.accountType })
      .from(user)
      .innerJoin(profile, eq(profile.userId, user.id))
      .where(
        and(eq(user.username, handle), notBanned(user.id), noBlockEitherWay(user.id, viewerId)),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`No member has the username @${handle}.`);
    if (row.id === viewerId) throw new BadRequestException("You can't link with yourself.");
    if (row.accountType === "organization") {
      throw new BadRequestException("Relationships link people, not organizations.");
    }
    return row.id;
  }
}
