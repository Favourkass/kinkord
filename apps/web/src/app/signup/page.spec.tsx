// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SEXUALITY_FIELD } from "@/constants/onboarding";
import SignupPage from "./page";
const fixture = vi.hoisted(() => ({
  stage: "account",
  update: vi.fn(),
  emailVerified: false,
  canSkipPhotos: true,
  resume: null as string | null,
}));
beforeEach(() => {
  fixture.stage = "account";
  fixture.emailVerified = false;
  fixture.canSkipPhotos = true;
  fixture.resume = null;
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
vi.mock("@/services/apiClient", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    get: async (path: string) =>
      path === "/me"
        ? { emailVerified: fixture.emailVerified }
        : { avatarUrl: null, coverUrl: null, roles: [], canSkipPhotos: fixture.canSkipPhotos },
    patch: (...args: unknown[]) => fixture.update(...args),
    post: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(fixture.resume ? { resume: fixture.resume } : {}),
}));
vi.mock("@/presenters/useSignupWizardPresenter", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/presenters/useSignupWizardPresenter")>();
  return {
    useSignupWizardPresenter: (
      resumed?: import("@/presenters/useSignupWizardPresenter").WizardStage,
    ) =>
      original.useSignupWizardPresenter(
        resumed ?? (fixture.stage as import("@/presenters/useSignupWizardPresenter").WizardStage),
      ),
  };
});
it("renders account signup without phone entry or phone instructions", () => {
  render(<SignupPage />);
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByLabelText("Username")).toBeTruthy();
  expect(screen.getByLabelText("State")).toBeTruthy();
  const sexuality = screen.getByLabelText("Sexuality");
  expect(screen.getByRole("option", { name: "Straight" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Bisexual" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Gay" })).toBeNull();
  fireEvent.change(sexuality, { target: { value: "Bisexual" } });
  expect((sexuality as HTMLSelectElement).value).toBe("Bisexual");
  expect(screen.getByText("Select your state")).toBeTruthy();
  expect(screen.queryByText("Select your county")).toBeNull();
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
  fireEvent.click(screen.getByRole("button", { name: "Bondage" }));
  fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
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

it("offers photo skipping and a searchable scrolling role list", async () => {
  fixture.stage = "profile";
  render(<SignupPage />);
  expect(await screen.findByRole("button", { name: "Skip photos for now" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Roles" }));
  fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: "aftercare" } });
  expect(screen.getByRole("region", { name: "Available roles" }).className).toContain(
    "overflow-y-auto",
  );
  expect(screen.getByRole("button", { name: "Aftercare Buddy" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Aftercare Specialist" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Bottom" })).toBeNull();
});

it("searches towns inside a state and allows an unlisted place", () => {
  render(<SignupPage />);
  expect((screen.getByLabelText("Region / City / Town") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.change(screen.getByRole("combobox", { name: "Search states" }), {
    target: { value: "Lagos" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Lagos" }));
  fireEvent.click(screen.getByLabelText("Region / City / Town"));
  fireEvent.change(screen.getByRole("combobox", { name: "Search regions / cities / towns" }), {
    target: { value: "Ikeja" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Ikeja" }));
  expect(screen.getByLabelText("Region / City / Town").textContent).toContain("Ikeja");
  fireEvent.click(screen.getByLabelText("Region / City / Town"));
  fireEvent.change(screen.getByRole("combobox", { name: "Search regions / cities / towns" }), {
    target: { value: "Other region" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Other region / city / town" }));
  const custom = screen.getByLabelText("Region / City / Town name") as HTMLInputElement;
  fireEvent.change(custom, { target: { value: "My village" } });
  expect(custom.value).toBe("My village");
});

it("offers former roles and the ten additions in the same searchable list", () => {
  fixture.stage = "profile";
  render(<SignupPage />);
  fireEvent.click(screen.getByRole("button", { name: "Roles" }));
  for (const role of [
    "Bottom",
    "Dominant",
    "Submissive",
    "Handler",
    "Rigger",
    "Rope Bunny",
    "Acolyte",
    "Adult Baby",
    "Aftercare Buddy",
  ]) {
    expect(screen.getByRole("button", { name: role })).toBeTruthy();
  }
  fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: "rigger" } });
  expect(screen.getByRole("button", { name: "Rigger" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Acolyte" })).toBeNull();
});

it.each([
  [true, 1],
  [false, 0],
])("says the email is verified on the welcome card only when it is (%s)", async (verified, n) => {
  fixture.stage = "welcome";
  fixture.emailVerified = verified;
  render(<SignupPage />);
  expect(screen.getByText(/Welcome to Kinkord/)).toBeTruthy();
  if (verified) expect(await screen.findByText("Email address verified")).toBeTruthy();
  else await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryAllByText("Email address verified")).toHaveLength(n);
});

it("opens the email step for a member the email hold sent back", async () => {
  fixture.resume = "email";
  render(<SignupPage />);
  expect(screen.getByRole("heading", { name: "VERIFY YOUR EMAIL" })).toBeTruthy();
  expect(await screen.findByText(/We emailed a 6-digit code/)).toBeTruthy();
});

it("no longer knows a phone step to resume", () => {
  fixture.resume = "phone";
  render(<SignupPage />);
  expect(screen.queryByRole("heading", { name: "VERIFY YOUR EMAIL" })).toBeNull();
  expect(screen.getByLabelText("Email address")).toBeTruthy();
});

it("keeps sexuality private and lets the member clear it", () => {
  render(<SignupPage />);
  const sexuality = screen.getByLabelText("Sexuality") as HTMLSelectElement;
  expect(
    screen.getByText("Only you can see this. You can change or clear it in Edit Profile."),
  ).toBeTruthy();
  const clear = screen.getByRole("option", { name: "Prefer not to say" }) as HTMLOptionElement;
  expect(clear.disabled).toBe(false);
  expect(sexuality.value).toBe("");
  fireEvent.change(sexuality, { target: { value: "Straight" } });
  expect(sexuality.value).toBe("Straight");
  fireEvent.change(sexuality, { target: { value: "" } });
  expect(sexuality.value).toBe("");
  expect(clear.selected).toBe(true);
});

it("offers the same sexualities the API accepts", () => {
  // The form is shown before the member can load GET /profile/options.
  const source = readFileSync(
    join(process.cwd(), "../api/src/profiles/profile-options.ts"),
    "utf8",
  );
  const list = source.match(/export const ORIENTATIONS = \[([^\]]*)\]/)?.[1];
  expect(list).toBeTruthy();
  expect(list!.match(/"[^"]+"/g)?.map((v) => JSON.parse(v))).toEqual(SEXUALITY_FIELD.options);
});

it("asks a member who has had a profile photo for new photos, with no skip", async () => {
  fixture.stage = "profile";
  fixture.canSkipPhotos = false;
  render(<SignupPage />);
  expect(
    await screen.findByText("Add a profile photo and a cover picture to continue."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Skip photos for now" })).toBeNull();
});
