// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SEXUALITY_FIELD } from "@/constants/onboarding";
import SignupPage from "./page";
const fixture = vi.hoisted(() => ({
  stage: "account",
  update: vi.fn(),
  emailVerified: false,
  canSkipPhotos: true,
  resume: null as string | null,
  country: "NG",
  options: vi.fn(),
}));
beforeEach(() => {
  fixture.stage = "account";
  fixture.emailVerified = false;
  fixture.canSkipPhotos = true;
  fixture.resume = null;
  fixture.country = "NG";
  fixture.options.mockReset().mockResolvedValue({ kinks: ["Bondage"], lookingFor: ["Friendship"] });
  fixture.update.mockReset().mockResolvedValue({});
});
afterEach(cleanup);
vi.mock("@/services/profile.service", () => ({
  profileApi: {
    own: async () => ({
      country: fixture.country,
      orientation: null,
      interests: [],
      lookingFor: [],
      limits: null,
    }),
    options: () => fixture.options(),
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
  expect(screen.queryByLabelText("Sexuality")).toBeNull();
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
  expect(screen.getByRole("listbox", { name: "Roles (max 5)" }).className).toContain(
    "overflow-y-auto",
  );
  expect(screen.getByRole("option", { name: "Aftercare Buddy" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Aftercare Specialist" })).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Bottom" })).toBeNull();
});

it("searches towns inside a state and allows an unlisted place", async () => {
  // The state's towns are fetched once it is picked: serve the generated file.
  vi.stubGlobal("fetch", async (url: string) => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    return new Response(readFileSync(resolve(__dirname, "../../../public", `.${url}`), "utf8"));
  });
  render(<SignupPage />);
  expect((screen.getByLabelText("Region / City / Town") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("link", { name: "CC BY 4.0" }).getAttribute("href")).toBe(
    "https://creativecommons.org/licenses/by/4.0/",
  );
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.change(screen.getByRole("combobox", { name: "Search states" }), {
    target: { value: "Lagos" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Lagos" }));
  fireEvent.click(screen.getByLabelText("Region / City / Town"));
  fireEvent.change(screen.getByRole("combobox", { name: "Search regions / cities / towns" }), {
    target: { value: "Ikeja" },
  });
  fireEvent.click(await screen.findByRole("option", { name: "Ikeja" }));
  expect(screen.getByLabelText("Region / City / Town").textContent).toContain("Ikeja");
  // "Other" stays pinned under the list, searched or not.
  fireEvent.click(screen.getByLabelText("Region / City / Town"));
  fireEvent.click(screen.getByRole("option", { name: "Other region / city / town" }));
  const custom = screen.getByLabelText("Region / City / Town name") as HTMLInputElement;
  fireEvent.change(custom, { target: { value: "My village" } });
  expect(custom.value).toBe("My village");
  // Picking "Other" or the same state again keeps what was typed.
  fireEvent.click(screen.getByLabelText("Region / City / Town"));
  fireEvent.click(screen.getByRole("option", { name: "Other region / city / town" }));
  fireEvent.click(screen.getByLabelText("State"));
  fireEvent.click(screen.getByRole("option", { name: "Lagos" }));
  expect((screen.getByLabelText("Region / City / Town name") as HTMLInputElement).value).toBe(
    "My village",
  );
  fireEvent.click(screen.getByLabelText("Region / City / Town"));
  fireEvent.change(screen.getByRole("combobox", { name: "Search regions / cities / towns" }), {
    target: { value: "Ikota Villa" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Use “Ikota Villa”" }));
  expect((screen.getByLabelText("Region / City / Town name") as HTMLInputElement).value).toBe(
    "Ikota Villa",
  );
  vi.unstubAllGlobals();
});

it("offers former and supplied roles in the searchable multi-select", () => {
  fixture.stage = "profile";
  render(<SignupPage />);
  fireEvent.click(screen.getByRole("button", { name: "Roles" }));
  for (const role of ["Dominant", "Acolyte", "Aftercare Buddy"]) {
    fireEvent.change(screen.getByLabelText("Search roles"), { target: { value: role } });
    expect(screen.getByRole("option", { name: role })).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("option", { name: "Aftercare Buddy" }));
  expect(screen.getByRole("button", { name: "Remove Aftercare Buddy" })).toBeTruthy();
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

it("hides sexuality and its helper for the default Nigerian signup", () => {
  render(<SignupPage />);
  expect(screen.queryByLabelText("Sexuality")).toBeNull();
  expect(
    screen.queryByText("Only you can see this. You can change or clear it in Edit Profile."),
  ).toBeNull();
});

it("offers only Male and Female in the Nigerian gender multi-select", () => {
  render(<SignupPage />);
  fireEvent.click(screen.getByRole("button", { name: "Gender" }));
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Male",
    "Female",
  ]);
  fireEvent.click(screen.getByRole("option", { name: "Male" }));
  fireEvent.click(screen.getByRole("option", { name: "Female" }));
  expect(screen.getByRole("button", { name: "Remove Male" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove Female" })).toBeTruthy();
});

it("removes the intermediate Tell us about you heading from the account page", () => {
  render(<SignupPage />);
  expect(screen.queryByRole("heading", { name: /TELL US ABOUT YOU/i })).toBeNull();
  expect(screen.getByLabelText("Confirm password")).toBeTruthy();
});

it.each(["GH", "KE", "US"])("shows sexuality on the preferences step for %s", async (country) => {
  fixture.country = country;
  fixture.stage = "preferences";
  render(<SignupPage />);
  expect(await screen.findByRole("button", { name: /Sexual orientation/ })).toBeTruthy();
  expect(screen.queryByLabelText("Sexuality")).toBeNull();
  expect(screen.getByText("STEP 4 OF 5")).toBeTruthy();
});

it("keeps sexuality hidden on the preferences step for Nigeria", async () => {
  fixture.stage = "preferences";
  render(<SignupPage />);
  await screen.findByRole("button", { name: /Kinks & Interests/ });
  expect(screen.queryByLabelText("Sexuality")).toBeNull();
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

it("lets the member skip step 4 when the preference options can't load", async () => {
  fixture.stage = "preferences";
  fixture.options.mockRejectedValue(new Error("Could not load preferences."));
  render(<SignupPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Skip for now" }));
  expect(await screen.findByText("STEP 5 OF 5")).toBeTruthy();
  expect(fixture.update).not.toHaveBeenCalled();
});

it("shows and selects Wyoming in the complete USA state list without searching", () => {
  fixture.stage = "country";
  render(<SignupPage />);
  fireEvent.click(screen.getByLabelText("Country"));
  fireEvent.click(screen.getByRole("option", { name: "USA" }));
  for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByLabelText("State"));
  const states = within(screen.getByRole("listbox", { name: "State" })).getAllByRole("option");
  expect(states).toHaveLength(51);
  expect(states.at(-1)?.textContent).toBe("Wyoming");
  fireEvent.click(screen.getByRole("option", { name: "Wyoming" }));
  expect(screen.getByLabelText("State").textContent).toContain("Wyoming");
});

it("lists Washington, D.C. separately and selects its compatible location value", () => {
  fixture.stage = "country";
  render(<SignupPage />);
  fireEvent.click(screen.getByLabelText("Country"));
  fireEvent.click(screen.getByRole("option", { name: "USA" }));
  for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByLabelText("State"));
  const states = within(screen.getByRole("listbox", { name: "State" }));
  expect(states.getByRole("option", { name: "Washington" })).toBeTruthy();
  fireEvent.click(states.getByRole("option", { name: "Washington, D.C." }));
  expect(screen.getByLabelText("State").textContent).toContain("Washington, D.C.");
});
