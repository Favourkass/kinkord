import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { AuthedRequest } from "../auth/auth.guard";
import { DRIZZLE, type Db } from "../db/db.module";
import { isAdmin } from "./admins";

/** Runs after AuthGuard, which has already put the signed-in member on the request. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user || !(await isAdmin(this.db, req.user))) {
      throw new ForbiddenException("Admins only.");
    }
    return true;
  }
}
