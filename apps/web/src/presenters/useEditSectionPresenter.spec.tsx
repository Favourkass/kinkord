// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MePM, OwnProfilePM, ProfileOptionsPM } from "@/domain/profile";
import { useEditSectionPresenter } from "./useEditSectionPresenter";

const replace = vi.fn();
const push = vi.fn();
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  }
  return {
    api: {
      get: (...a: unknown[]) => apiGet(...a),
      patch: (...a: unknown[]) => apiPatch(...a),
      post: vi.fn(),
      del: vi.fn(),
    },
    uploadToPresignedUrl: vi.fn(),
    ApiError,
  };
});

const profile: OwnProfilePM = {
  displayName: "Naughty Neze",
  bio: "Chill",
  pronouns: null,
  country: "NG",
  state: "Delta",
  city: "Abraka",
  dateOfBirth: "1998-03-26",
  gender: "Female",
  roles: ["Dominant"],
  relationshipStatus: "Single",
  lookingFor: [],
  interests: ["Bondage"],
  orientation: null,
  bodyType: null,
  languages: ["English"],
  location: null,
  phone: null,
  phoneVerified: false,
  avatarUrl: null,
  coverUrl: null,
  nationality: "NG",
  occupation: null,
  limits: null,
  socialLinks: { facebook: "https://facebook.com/nene" },
  profileVisibility: "public",
  displayNameChangedAt: null,
  canChangeDisplayNameAt: null,
  usernameChangedAt: "2026-09-01T00:00:00.000Z",
  canChangeUsernameAt: "2026-10-01T00:00:00.000Z",
};
const me: MePM = {
  id: "u1",
  email: "a@b.c",
  emailVerified: true,
  username: "nene",
  displayUsername: "Nene",
  twoFactorEnabled: false,
  createdAt: "2025-05-25T10:00:00.000Z",
};
const options: ProfileOptionsPM = {
  genders: ["Male", "Female"],
  relationshipStatuses: ["Single", "Married"],
  roles: ["Dominant", "Switch"],
  kinks: ["Bondage", "Latex"],
  lookingFor: ["Events"],
  languages: ["English"],
  visibilities: ["public", "friends"],
  socialPlatforms: ["facebook", "x"],
  nameChangeCooldownDays: 30,
};

const serve = (own: OwnProfilePM = profile) =>
  apiGet.mockImplementation(async (path: string) =>
    path === "/me" ? me : path === "/profile" ? own : options,
  );

describe("useEditSectionPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    apiGet.mockReset();
    apiPatch.mockReset();
    serve();
  });

  it("loads the Basic rows with display-ready values", async () => {
    const { result } = renderHook(() => useEditSectionPresenter("basic"));
    expect(result.current.heading).toBe("Basic Information");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiGet.mock.calls.map((c) => c[0])).toEqual(["/me", "/profile", "/profile/options"]);
    expect(result.current.rows.map((r) => [r.title, r.subtitle])).toEqual([
      ["Username", "@Nene"],
      ["Display Name", "Naughty Neze"],
      ["Bio", "Chill"],
      ["Gender", "Female"],
      ["Date of Birth", "26 Mar 1998"],
      ["Nationality", "Nigeria"],
      ["Relationship Status", "Single"],
    ]);
    expect(result.current.rows[0].icon).toMatch(/row-username\.svg$/);
    expect(result.current.editor).toBeNull();
  });

  it("opens a row, saves it through PATCH /profile and shows the new value", async () => {
    apiPatch.mockResolvedValue({ ...profile, bio: "New bio" });
    const { result } = renderHook(() => useEditSectionPresenter("basic"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.rows[2].onClick?.());
    expect(result.current.editor?.title).toBe("Bio");
    expect(result.current.editor?.canSave).toBe(false);
    act(() => result.current.editor?.onDraft({ kind: "textarea", value: "New bio" }));
    expect(result.current.editor?.canSave).toBe(true);
    act(() => result.current.editor?.onSave());
    await waitFor(() => expect(result.current.editor).toBeNull());
    expect(apiPatch).toHaveBeenCalledWith("/profile", { bio: "New bio" });
    expect(result.current.notice).toBe("Saved.");
    expect(result.current.rows[2].subtitle).toBe("New bio");
  });

  it("locks the username for 30 days, then changes it through its own endpoint", async () => {
    const locked = renderHook(() => useEditSectionPresenter("basic"));
    await waitFor(() => expect(locked.result.current.loading).toBe(false));
    act(() => locked.result.current.rows[0].onClick?.());
    expect(locked.result.current.editor?.lockMessage).toBe(
      "Locked — you can change this again on 1 Oct 2026.",
    );
    expect(locked.result.current.editor?.canSave).toBe(false);

    serve({ ...profile, canChangeUsernameAt: null });
    apiPatch.mockResolvedValue({
      username: "sir.tega",
      displayUsername: "Sir.Tega",
      usernameChangedAt: "2026-09-12T10:00:00.000Z",
      canChangeUsernameAt: "2026-10-12T10:00:00.000Z",
    });
    const { result } = renderHook(() => useEditSectionPresenter("basic"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.rows[0].onClick?.());
    expect(result.current.editor?.lockMessage).toBeNull();
    act(() => result.current.editor?.onDraft({ kind: "text", value: "Sir.Tega" }));
    act(() => result.current.editor?.onSave());
    await waitFor(() => expect(result.current.editor).toBeNull());
    expect(apiPatch).toHaveBeenCalledWith("/profile/username", { username: "Sir.Tega" });
    expect(result.current.rows[0].subtitle).toBe("@Sir.Tega");
  });

  it("validates locally first, then surfaces the API's field error in the sheet", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiPatch.mockRejectedValue(
      new ApiError(400, {
        displayName: ["You can change your display name again on 12 Oct 2026."],
      }),
    );
    const { result } = renderHook(() => useEditSectionPresenter("basic"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.rows[1].onClick?.());
    act(() => result.current.editor?.onDraft({ kind: "text", value: "ab" }));
    act(() => result.current.editor?.onSave());
    expect(result.current.editor?.error).toBe("Too short.");
    expect(apiPatch).not.toHaveBeenCalled();

    act(() => result.current.editor?.onDraft({ kind: "text", value: "Valid Name" }));
    act(() => result.current.editor?.onSave());
    await waitFor(() =>
      expect(result.current.editor?.error).toBe(
        "You can change your display name again on 12 Oct 2026.",
      ),
    );
    expect(result.current.editor?.saving).toBe(false);
  });

  it("renders Privacy as cards with labelled visibility options", async () => {
    const { result } = renderHook(() => useEditSectionPresenter("privacy"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.variant).toBe("cards");
    expect(result.current.rows.map((r) => r.subtitle)).toEqual(["Facebook", "Public"]);
    act(() => result.current.rows[1].onClick?.());
    const editor = result.current.editor?.editor;
    expect(editor?.kind).toBe("single");
    if (editor?.kind === "single") {
      expect(editor.options.map((o) => o.label)).toEqual(["Public", "Friends only"]);
    }
  });

  it("sends an expired session back to login", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValue(new ApiError(401, {}));
    renderHook(() => useEditSectionPresenter("kinks"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
