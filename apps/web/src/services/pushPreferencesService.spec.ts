import { describe, expect, it, vi } from "vitest";
import { pushPreferencesRepository } from "@/repositories/pushPreferencesRepository";
import { loadPushPreferences, savePushPreference } from "./pushPreferencesService";

vi.mock("@/repositories/pushPreferencesRepository", () => ({
  pushPreferencesRepository: { read: vi.fn(), update: vi.fn() },
}));

describe("push preferences service", () => {
  it("loads the member's switches", async () => {
    await loadPushPreferences();
    expect(pushPreferencesRepository.read).toHaveBeenCalled();
  });

  it("changes one kind without sending the others", async () => {
    await savePushPreference("follows", false);
    expect(pushPreferencesRepository.update).toHaveBeenCalledWith({ follows: false });
  });
});
