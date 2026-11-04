import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { SUPER_ADMIN_EMAILS } from "../moderation/admins";
import { TeamPageAdminController } from "./team-page-admin.controller";
import { type TeamPageService } from "./team-page.service";

const staff = { user: { id: "s1", email: "staff@example.com", emailVerified: true } } as never;
const founder = { user: { id: "f1", email: SUPER_ADMIN_EMAILS[0], emailVerified: true } } as never;

describe("TeamPageAdminController", () => {
  it("lets every admin see the team, and tells them whether they can change it", async () => {
    const forAdmins = vi.fn(async () => []);
    const controller = new TeamPageAdminController({ forAdmins } as unknown as TeamPageService);
    await expect(controller.list(staff)).resolves.toEqual({ members: [], canManage: false });
    await expect(controller.list(founder)).resolves.toEqual({ members: [], canManage: true });
  });

  it("lets only the founders add, change or remove", () => {
    const setTitle = vi.fn();
    const remove = vi.fn();
    const controller = new TeamPageAdminController({
      setTitle,
      remove,
    } as unknown as TeamPageService);
    expect(() => controller.setTitle(staff, { username: "ada", title: "Engineer" })).toThrow(
      "Only the founders",
    );
    expect(() => controller.remove(staff, "u7")).toThrow("Only the founders");
    expect(setTitle).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("takes a handle with or without @ and a role of up to 60 characters", async () => {
    const setTitle = vi.fn(async () => ({}));
    const remove = vi.fn(async () => ({}));
    const controller = new TeamPageAdminController({
      setTitle,
      remove,
    } as unknown as TeamPageService);
    await controller.setTitle(founder, { username: " @ada ", title: " Software Engineer " });
    expect(setTitle).toHaveBeenCalledWith("f1", "ada", "Software Engineer");
    expect(() => controller.setTitle(founder, { username: "ada", title: "  " })).toThrow(
      "Say what they do at Kinkord.",
    );
    expect(() => controller.setTitle(founder, { username: "ada", title: "x".repeat(61) })).toThrow(
      "Keep the role to 60 characters.",
    );
    expect(() => controller.setTitle(founder, { username: "@", title: "Engineer" })).toThrow(
      "Enter their username.",
    );
    expect(() => controller.remove(founder, "  ")).toThrow(BadRequestException);
    await controller.remove(founder, "u7");
    expect(remove).toHaveBeenCalledWith("f1", "u7");
  });
});
