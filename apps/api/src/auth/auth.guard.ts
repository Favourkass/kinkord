import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { AUTH, Auth } from "./auth.instance";

export interface AuthedRequest extends Request {
  user: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>["user"];
  session: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>["session"];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!result) throw new UnauthorizedException("Not signed in");
    req.user = result.user;
    req.session = result.session;
    return true;
  }
}
