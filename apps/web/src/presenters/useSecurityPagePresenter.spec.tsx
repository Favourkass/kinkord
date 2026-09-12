// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSecurityPagePresenter } from "./useSecurityPagePresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const me = vi.fn();
vi.mock("@/services/profile.service", () => ({ profileApi: { me: () => me() } }));

type AuthCall = (...a: unknown[]) => Promise<{ error: null }>;
const changePassword = vi.fn<AuthCall>(async () => ({ error: null }));
const disable = vi.fn<AuthCall>(async () => ({ error: null }));
vi.mock("@/services/authClient", () => ({
  authClient: {
    signOut: vi.fn(),
    changePassword: (...a: unknown[]) => changePassword(...a),
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
      disable: (...a: unknown[]) => disable(...a),
    },
  },
}));

describe("useSecurityPagePresenter", () => {
  beforeEach(() => {
    me.mockReset().mockResolvedValue({ twoFactorEnabled: true });
    changePassword.mockClear();
    disable.mockClear();
  });

  it("reflects the account's 2FA state and wires the disable + password flows", async () => {
    const { result } = renderHook(() => useSecurityPagePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view.title).toBe("Security & 2FA");
    expect(result.current.view.twoFactor).toMatchObject({
      on: true,
      statusLabel: "ON",
      actionLabel: "Disable 2FA",
      setup: null,
    });

    act(() => result.current.view.twoFactor.onPassword("supersecret123"));
    act(() => result.current.view.twoFactor.onAction());
    await waitFor(() => expect(disable).toHaveBeenCalledWith({ password: "supersecret123" }));
    await waitFor(() => expect(result.current.view.twoFactor.on).toBe(false));
    expect(result.current.view.twoFactor.actionLabel).toBe("Enable 2FA");

    act(() => result.current.view.password.onCurrent("oldpassword1"));
    act(() => result.current.view.password.onNext("newpassword22"));
    act(() => result.current.view.password.onSubmit());
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "oldpassword1",
        newPassword: "newpassword22",
        revokeOtherSessions: true,
      }),
    );
    await waitFor(() => expect(result.current.view.notice).toMatch(/Password changed/));
  });
});
