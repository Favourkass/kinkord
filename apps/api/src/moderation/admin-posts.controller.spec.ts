import { describe, it, expect, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthGuard, type AuthedRequest } from "../auth/auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminPostsController } from "./admin-posts.controller";
const req = { user: { id: "admin" } } as AuthedRequest;
const id = "11111111-1111-4111-8111-111111111111";
function make() {
  const service = { list: vi.fn(), archive: vi.fn() };
  return { service, c: new AdminPostsController(service as never) };
}
describe("All posts admin boundary", () => {
  it("requires auth and admin permissions for every endpoint", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminPostsController)).toEqual([
      AuthGuard,
      AdminGuard,
    ]);
  });
  it("defaults to every post and validates pagination/status", () => {
    const { c, service } = make();
    c.list({});
    expect(service.list).toHaveBeenCalledWith(1, "all");
    c.list({ page: "2", status: "archived" });
    expect(service.list).toHaveBeenCalledWith(2, "archived");
    for (const input of [{ page: 0 }, { page: 1.5 }, { page: "NaN" }, { status: "private" }])
      expect(() => c.list(input)).toThrow(BadRequestException);
  });
  it("uses the acting admin and explicit archive/restore action", () => {
    const { c, service } = make();
    c.archive(req, id, { archived: true });
    c.archive(req, id, { archived: false });
    expect(service.archive.mock.calls).toEqual([
      ["admin", id, true],
      ["admin", id, false],
    ]);
    for (const body of [{ archived: "true" }, {}, { archived: true, deleted: true }])
      expect(() => c.archive(req, id, body)).toThrow(BadRequestException);
    expect(() => c.archive(req, "bad", { archived: true })).toThrow(BadRequestException);
  });
});
