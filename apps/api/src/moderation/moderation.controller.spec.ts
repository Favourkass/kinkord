import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthedRequest } from "../auth/auth.guard";
import { ModerationController } from "./moderation.controller";
import type { ReportsService } from "../safety/reports.service";
import type { ModerationService } from "./moderation.service";

const founder = { user: { id: "u1", email: "maxihandsome@gmail.com", emailVerified: true } };
const req = founder as unknown as AuthedRequest;
/** An admin by a staff row, not a founder. */
const teammate = {
  user: { id: "u7", email: "jane@example.com", emailVerified: true },
} as unknown as AuthedRequest;

function make() {
  const service = {
    setTeamBadge: vi.fn(async () => ({ teamMember: true })),
    isAdmin: vi.fn(async () => true),
    block: vi.fn(async () => ({ blocked: "u9", postsRemoved: 0 })),
    deleteMember: vi.fn(async () => ({ deleted: "u9" })),
    addRule: vi.fn(async () => ({ id: "r1" })),
    team: vi.fn(async () => []),
    addAdmin: vi.fn(async () => ({ id: "u7" })),
    removeAdmin: vi.fn(async () => ({ removed: "u7" })),
    setAdminSilver: vi.fn(async () => ({ id: "u7", silver: "given" })),
    setOrganization: vi.fn(async () => ({ organization: true, country: "NG" })),
  };
  const reports = {
    list: vi.fn(async () => []),
    resolve: vi.fn(async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      status: "resolved",
    })),
  };
  const controller = new ModerationController(
    service as unknown as ModerationService,
    reports as unknown as ReportsService,
  );
  return { controller, service, reports };
}

describe("ModerationController", () => {
  it("lists open reports by default, or the status asked for", async () => {
    const { controller, reports } = make();
    await controller.reportQueue({});
    await controller.reportQueue({ status: "dismissed" });
    expect(reports.list.mock.calls).toEqual([["open"], ["dismissed"]]);
  });

  it("closes a report as the acting admin, and refuses a malformed id or status", async () => {
    const { controller, reports } = make();
    const id = "11111111-1111-4111-8111-111111111111";
    await controller.resolveReport(req, id, { status: "resolved" });
    expect(reports.resolve).toHaveBeenCalledWith("u1", id, "resolved");
    expect(() => controller.resolveReport(req, "r1", { status: "resolved" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.resolveReport(req, id, { status: "open" })).toThrow(
      BadRequestException,
    );
  });

  it("tells the app whether the signed-in member is an admin", async () => {
    const { controller } = make();
    await expect(controller.access(req)).resolves.toEqual({ isAdmin: true, isFounder: true });
    await expect(controller.access(teammate)).resolves.toEqual({
      isAdmin: true,
      isFounder: false,
    });
  });

  it("passes a valid block through with the acting admin", async () => {
    const { controller, service } = make();
    await controller.block(req, "u9", { reason: "harassment", deletePosts: true });
    expect(service.block).toHaveBeenCalledWith("u1", "u9", {
      reason: "harassment",
      deletePosts: true,
    });
  });

  it("refuses a block reason longer than the log can usefully hold", async () => {
    const { controller, service } = make();
    await expect(controller.block(req, "u9", { reason: "x".repeat(301) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.block).not.toHaveBeenCalled();
  });

  it("reads ?block=1 as also blocking the deleted member", async () => {
    const { controller, service } = make();
    await controller.deleteMember(req, "u9", "1", undefined);
    await controller.deleteMember(req, "u9", undefined, undefined);
    expect(service.deleteMember.mock.calls.map((c) => (c[2] as { block: boolean }).block)).toEqual([
      true,
      false,
    ]);
  });

  it("rejects a rule of a kind the sign-up check doesn't know", async () => {
    const { controller, service } = make();
    await expect(
      controller.addRule(req, { kind: "username", value: "x", action: "block" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.addRule).not.toHaveBeenCalled();
  });

  it("shows every admin the team, and only the founders that they can change it", async () => {
    const { controller } = make();
    await expect(controller.team(req)).resolves.toEqual({ admins: [], canManage: true });
    await expect(controller.team(teammate)).resolves.toEqual({ admins: [], canManage: false });
  });

  it("adds an admin by username, without the @ and in lower case", async () => {
    const { controller, service } = make();
    await controller.addAdmin(req, { username: " @LadyJane " });
    expect(service.addAdmin).toHaveBeenCalledWith("u1", "ladyjane");
    await expect(controller.addAdmin(req, { username: "@" })).rejects.toThrow(
      "Enter their username.",
    );
    await expect(controller.addAdmin(req, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(service.addAdmin).toHaveBeenCalledTimes(1);
  });

  it("lets only the founders add or remove admins", async () => {
    const { controller, service } = make();
    await expect(controller.addAdmin(teammate, { username: "ladyjane" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(controller.removeAdmin(teammate, "u8")).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.addAdmin).not.toHaveBeenCalled();
    expect(service.removeAdmin).not.toHaveBeenCalled();
    await controller.removeAdmin(req, "u7");
    expect(service.removeAdmin).toHaveBeenCalledWith("u1", "u7");
  });
});

describe("team badge admin boundary", () => {
  it("uses the acting admin and accepts only an explicit boolean", async () => {
    const { controller, service } = make();
    await controller.teamBadge(req, "u9", { enabled: true });
    expect(service.setTeamBadge).toHaveBeenCalledWith("u1", "u9", true);
    for (const body of [{ enabled: "true" }, {}, { enabled: true, role: "admin" }])
      expect(() => controller.teamBadge(req, "u9", body)).toThrow(BadRequestException);
  });
  it("lets only the founders give or remove it, not a staff admin", () => {
    const { controller, service } = make();
    for (const enabled of [true, false])
      expect(() => controller.teamBadge(teammate, "u9", { enabled })).toThrow(ForbiddenException);
    expect(() => controller.teamBadge(teammate, "u7", { enabled: true })).toThrow(
      ForbiddenException,
    );
    expect(service.setTeamBadge).not.toHaveBeenCalled();
  });
  it("requires both authentication and admin authorization", async () => {
    const { GUARDS_METADATA } = await import("@nestjs/common/constants");
    const { AdminGuard } = await import("./admin.guard");
    const { AuthGuard } = await import("../auth/auth.guard");
    expect(Reflect.getMetadata(GUARDS_METADATA, ModerationController)).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ModerationController.prototype.teamBadge),
    ).toContain(AdminGuard);
  });
});

describe("given Silver admin boundary", () => {
  it("gives or takes back as the acting founder, and accepts only an explicit boolean", async () => {
    const { controller, service } = make();
    await controller.adminSilver(req, "u7", { enabled: true });
    await controller.adminSilver(req, "u7", { enabled: false });
    expect(service.setAdminSilver.mock.calls).toEqual([
      ["u1", "u7", true],
      ["u1", "u7", false],
    ]);
    for (const body of [{ enabled: "true" }, {}, { enabled: true, until: "2099-12-31" }])
      expect(() => controller.adminSilver(req, "u7", body)).toThrow(BadRequestException);
  });

  it("lets only the founders do it, not a staff admin, not even for themselves", () => {
    const { controller, service } = make();
    for (const enabled of [true, false])
      expect(() => controller.adminSilver(teammate, "u8", { enabled })).toThrow(
        "Only the founders can give or remove Silver.",
      );
    expect(() => controller.adminSilver(teammate, "u7", { enabled: true })).toThrow(
      ForbiddenException,
    );
    expect(service.setAdminSilver).not.toHaveBeenCalled();
  });

  it("requires both authentication and admin authorization", async () => {
    const { GUARDS_METADATA } = await import("@nestjs/common/constants");
    const { AdminGuard } = await import("./admin.guard");
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ModerationController.prototype.adminSilver),
    ).toContain(AdminGuard);
  });
});

describe("organization accounts admin boundary", () => {
  it("lets only the founders make an account an organization's", () => {
    const { controller, service } = make();
    expect(() => controller.organization(teammate, "u9", { enabled: true, country: "NG" })).toThrow(
      "Only the founders can make an account an organization's.",
    );
    expect(service.setOrganization).not.toHaveBeenCalled();
  });

  it("reads the country however it's cased, and nothing else", async () => {
    const { controller, service } = make();
    await controller.organization(req, "u9", { enabled: true, country: " ng " });
    await controller.organization(req, "u9", { enabled: true, country: "all" });
    await controller.organization(req, "u9", { enabled: false });
    expect(service.setOrganization.mock.calls).toEqual([
      ["u1", "u9", true, "NG"],
      ["u1", "u9", true, "ALL"],
      ["u1", "u9", false, null],
    ]);
    for (const body of [
      { enabled: "yes" },
      { enabled: true, country: "Nigeria" },
      { enabled: true, role: "x" },
    ])
      expect(() => controller.organization(req, "u9", body)).toThrow(BadRequestException);
  });
});
