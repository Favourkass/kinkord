import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export function getCurrentUserId(request: { user: { id: string } }) {
  return request.user.id;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  getCurrentUserId(ctx.switchToHttp().getRequest()),
);
