// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSecurityPagePresenter } from "./useSecurityPagePresenter";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const me = vi.fn();
const own = vi.fn();
const update = vi.fn();
vi.mock("@/services/profile.service", () => ({
  profileApi: { me: () => me(), own: () => own(), update: (...args: unknown[]) => update(...args) },
}));

const sendCode = vi.fn();
const verifyCode = vi.fn();
vi.mock("@/services/verification.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/verification.service")>()),
  verificationApi: {
    sendCode: (...a: unknown[]) => sendCode(...a),
    verify: (...a: unknown[]) => verifyCode(...a),
  },
}));

type AuthCall = (...a: unknown[]) => Promise<{ error: null }>;
const changePassword = vi.fn<AuthCall>(async () => ({ error: null }));
const disable = vi.fn<AuthCall>(async () => ({ error: null }));
const enable2fa = vi.fn();
vi.mock("@/services/authClient", () => ({
  authClient: {
    signOut: vi.fn(),
    changePassword: (...a: unknown[]) => changePassword(...a),
    twoFactor: {
      enable: (...a: unknown[]) => enable2fa(...a),
      verifyTotp: vi.fn(),
      disable: (...a: unknown[]) => disable(...a),
    },
  },
}));

describe("useSecurityPagePresenter", () => {
  beforeEach(() => {
    update.mockReset().mockResolvedValue({ phone: "+2348031234567", phoneVerified: false });
    me.mockReset().mockResolvedValue({ twoFactorEnabled: true });
    own.mockReset().mockResolvedValue({ phone: "+2349127883266", phoneVerified: false });
    sendCode.mockReset().mockResolvedValue({
      otpId: "11111111-1111-4111-8111-111111111111",
      sentTo: "+234******3266",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAfterMs: 60_000,
    });
    verifyCode.mockReset().mockResolvedValue({ verified: true, attemptsLeft: null });
    changePassword.mockClear();
    disable.mockClear();
  });

  it("offers the setup key and the app link for setting up on the same phone, and copies them", async () => {
    me.mockResolvedValue({ twoFactorEnabled: false });
    const uri = "otpauth://totp/Kinkord:ada?secret=JBSWY3DPEHPK3PXP&issuer=Kinkord";
    enable2fa.mockResolvedValue({
      data: { totpURI: uri, backupCodes: ["aaaa-1111", "bbbb-2222"] },
      error: null,
    });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { result } = renderHook(() => useSecurityPagePresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.view.twoFactor.onPassword("supersecret123"));
    act(() => result.current.view.twoFactor.onAction());
    await waitFor(() => expect(result.current.view.twoFactor.setup).not.toBeNull());
    expect(result.current.view.twoFactor.setup).toMatchObject({
      setupKey: "JBSW Y3DP EHPK 3PXP",
      openAppHref: uri,
      copyKeyLabel: "Copy setup key",
      copyCodesLabel: "Copy backup codes",
    });

    // The key is copied whole, without the spaces that only help reading it.
    await act(async () => result.current.view.twoFactor.setup?.onCopyKey());
    expect(writeText).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
    expect(result.current.view.twoFactor.setup?.copyKeyLabel).toBe("Copied");

    await act(async () => result.current.view.twoFactor.setup?.onCopyCodes());
    expect(writeText).toHaveBeenLastCalledWith("aaaa-1111\nbbbb-2222");
    expect(result.current.view.twoFactor.setup?.copyCodesLabel).toBe("Copied");
    expect(result.current.view.twoFactor.setup?.copyKeyLabel).toBe("Copy setup key");
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

  describe("phone verification", () => {
    it("offers to verify the number already on the profile", async () => {
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.view.phone.hasNumber).toBe(true));

      expect(result.current.view.phone.verified).toBe(false);
      expect(result.current.view.phone.statusLabel).toBe("NOT VERIFIED");
      expect(result.current.view.phone.number).toBe("+2349127883266");
      expect(result.current.view.phone.sendLabel).toBe("Text me a code");
    });

    it("saves a number in Settings and then enables verification", async () => {
      own.mockResolvedValue({ phone: null, phoneVerified: false });
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.view.phone.entry.onChange("0803 123 4567"));
      act(() => result.current.view.phone.entry.onSave());
      await waitFor(() => expect(result.current.view.phone.hasNumber).toBe(true));
      expect(update).toHaveBeenCalledWith({ phone: "+2348031234567" });
      expect(result.current.view.phone.canSend).toBe(true);
      expect(sendCode).not.toHaveBeenCalled();
    });

    it("offers optional phone entry when there is no number yet", async () => {
      own.mockResolvedValue({ phone: null, phoneVerified: false });
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.view.phone.hasNumber).toBe(false);
      expect(result.current.view.phone.canSend).toBe(false);
      expect(result.current.view.phone.missingNote).toMatch(/optional/);
    });

    it("shows the badge for a number that is already verified", async () => {
      own.mockResolvedValue({ phone: "+2349127883266", phoneVerified: true });
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.view.phone.verified).toBe(true));

      expect(result.current.view.phone.statusLabel).toBe("VERIFIED");
    });

    it("sends a code, then flips to verified once it checks out", async () => {
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.view.phone.hasNumber).toBe(true));

      await act(async () => result.current.view.phone.onSend());
      expect(sendCode).toHaveBeenCalled();
      expect(result.current.view.phone.sent).toBe(true);
      expect(result.current.view.phone.sentNote).toMatch(/\+234\*+3266/);
      // Cooldown is mirrored from the API so the resend link is not dead.
      expect(result.current.view.phone.cooldownLabel).toMatch(/01:00|00:59/);

      act(() => result.current.view.phone.onCode("123456"));
      await act(async () => result.current.view.phone.onSubmit());

      expect(verifyCode).toHaveBeenCalledWith(
        "phone",
        "11111111-1111-4111-8111-111111111111",
        "123456",
      );
      expect(result.current.view.phone.verified).toBe(true);
      expect(result.current.view.phone.statusLabel).toBe("VERIFIED");
    });
  });

  describe("email verification", () => {
    it("shows the account as unverified and offers a code", async () => {
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.view.email.verified).toBe(false);
      expect(result.current.view.email.statusLabel).toBe("NOT VERIFIED");
      expect(result.current.view.email.sendLabel).toBe("Email me a code");
    });

    it("shows the badge when the account is already verified", async () => {
      me.mockResolvedValue({ twoFactorEnabled: true, emailVerified: true });
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.view.email.verified).toBe(true));
      expect(result.current.view.email.statusLabel).toBe("VERIFIED");
    });

    it("sends to the email channel, then flips to verified", async () => {
      sendCode.mockResolvedValue({
        otpId: "22222222-2222-4222-8222-222222222222",
        sentTo: "t**a@kinkord.com",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAfterMs: 60_000,
      });
      const { result } = renderHook(() => useSecurityPagePresenter());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => result.current.view.email.onSend());
      expect(sendCode).toHaveBeenCalledWith("email");
      expect(result.current.view.email.sentNote).toMatch(/t\*\*a@kinkord\.com/);

      act(() => result.current.view.email.onCode("123456"));
      await act(async () => result.current.view.email.onSubmit());

      expect(verifyCode).toHaveBeenCalledWith(
        "email",
        "22222222-2222-4222-8222-222222222222",
        "123456",
      );
      expect(result.current.view.email.verified).toBe(true);
    });
  });
});
