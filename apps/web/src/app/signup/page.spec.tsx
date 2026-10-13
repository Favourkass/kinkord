// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SignupPage from "./page";
const fixture = vi.hoisted(() => ({ stage: "account", update: vi.fn() }));
beforeEach(() => {
  fixture.stage = "account";
  fixture.update.mockReset().mockResolvedValue({});
});
afterEach(cleanup);
vi.mock("@/services/profile.service", () => ({
  profileApi: {
    own: async () => ({ interests: [], lookingFor: [], limits: null }),
    options: async () => ({ kinks: ["Bondage"], lookingFor: ["Friendship"] }),
    update: (...args: unknown[]) => fixture.update(...args),
  },
}));
vi.mock("@/services/verification.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/verification.service")>()),
  verificationApi: {
    sendCode: async () => ({
      otpId: "test",
      sentTo: "member@example.com",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAfterMs: 60_000,
    }),
    verify: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/presenters/useSignupWizardPresenter", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/presenters/useSignupWizardPresenter")>();
  return {
    useSignupWizardPresenter: () =>
      original.useSignupWizardPresenter(
        fixture.stage as import("@/presenters/useSignupWizardPresenter").WizardStage,
      ),
  };
});
it("renders account signup without phone entry or phone instructions", () => {
  render(<SignupPage />);
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByLabelText("Username")).toBeTruthy();
  expect(screen.getByLabelText("County")).toBeTruthy();
  const sexuality = screen.getByLabelText("Sexuality (optional)");
  expect(screen.getByRole("option", { name: "Straight" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Bisexual" })).toBeTruthy();
  fireEvent.change(sexuality, { target: { value: "Bisexual" } });
  expect((sexuality as HTMLSelectElement).value).toBe("Bisexual");
  expect(screen.getByText("Select your county")).toBeTruthy();
  expect(screen.queryByText("Select your state")).toBeNull();
  expect(screen.queryByText(/phone number/i)).toBeNull();
  expect(screen.queryByText(/one number can only/i)).toBeNull();
  expect(document.querySelector('input[type="tel"]')).toBeNull();
});

it("shows the three preference rows at step 4 and saves a selection before photos", async () => {
  fixture.stage = "preferences";
  render(<SignupPage />);
  const kinks = await screen.findByRole("button", { name: /Kinks & Interests/ });
  expect(screen.getByText("STEP 4 OF 5")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Looking For/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Limits/ })).toBeTruthy();
  fireEvent.click(kinks);
  fireEvent.click(screen.getByRole("button", { name: "Bondage", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  await waitFor(() =>
    expect(fixture.update).toHaveBeenCalledWith({
      interests: ["Bondage"],
      lookingFor: [],
      limits: null,
    }),
  );
  expect(await screen.findByText("STEP 5 OF 5")).toBeTruthy();
});

it("uses email verification copy without phone or SMS prompts", async () => {
  fixture.stage = "email";
  render(<SignupPage />);
  expect(screen.getByRole("heading", { name: "VERIFY YOUR EMAIL" })).toBeTruthy();
  expect(await screen.findByText(/We emailed a 6-digit code/)).toBeTruthy();
  expect(screen.queryByText(/Text me a code|Wrong number|Skip for now/i)).toBeNull();
});
