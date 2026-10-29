import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MePM, OwnProfilePM, ProfileOptionsPM } from "@/domain/profile";

const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
const upload = vi.fn<(url: string, file: File) => Promise<void>>(async () => {});
vi.mock("./apiClient", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    post: (...a: unknown[]) => apiPost(...a),
    del: vi.fn(),
  },
  uploadToPresignedUrl: (url: string, file: File) => upload(url, file),
}));
// Canvas is unavailable in node, so stand in for the resizer.
const buildUploadSet = vi.fn();
vi.mock("@/util/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/util/image")>()),
  buildUploadSet: (...a: unknown[]) => buildUploadSet(...a),
}));

import {
  SECTION_ROWS,
  adultCutoff,
  buildEditRow,
  buildEditRows,
  draftChanged,
  fieldErrorMessage,
  initialDraft,
  loadCityOptions,
  locationLine,
  nationalityOptions,
  patchFor,
  profileApi,
  uploadProfileImage,
  usernameFromDraft,
  validateDraft,
} from "./profile.service";

const profile: OwnProfilePM = {
  displayName: "Naughty Neze",
  bio: "Chill",
  pronouns: null,
  country: "NG",
  state: "Delta",
  city: "Abraka",
  dateOfBirth: "1998-03-26",
  gender: "female",
  roles: ["Dominant"],
  relationshipStatus: "Single",
  lookingFor: [],
  interests: ["Bondage", "Latex"],
  orientation: null,
  bodyType: null,
  languages: ["English"],
  location: "Abraka, Delta State, Nigeria",
  phone: null,
  phoneVerified: false,
  avatarUrl: null,
  coverUrl: null,
  nationality: "NG",
  occupation: null,
  limits: null,
  socialLinks: { facebook: "https://facebook.com/nene" },
  profileVisibility: "public",
  identityVerified: false,
  showVerifiedBadge: true,
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
  orientations: ["Straight", "Bisexual"],
  relationshipStatuses: ["Single", "Married"],
  roles: ["Dominant", "Switch"],
  kinks: ["Bondage", "Latex", "Wax play"],
  lookingFor: ["Events"],
  languages: ["English", "Pidgin"],
  visibilities: ["public", "friends"],
  socialPlatforms: ["facebook", "x"],
  nameChangeCooldownDays: 30,
};
const ctx = { profile, me, options, now: new Date("2026-09-12T10:00:00Z") };
const valuesOf = (section: Parameters<typeof buildEditRows>[0]) =>
  Object.fromEntries(buildEditRows(section, ctx).map((r) => [r.key, r.value]));

describe("buildEditRows", () => {
  it("edits private orientation selections separately and caps roles and orientations at five", () => {
    const context = {
      ...ctx,
      profile: { ...profile, country: "GH", orientationSelections: ["Queer"] },
      options: { ...options, orientationSelections: ["Queer", "Asexual"] },
    };
    const row = buildEditRow("orientationSelections", context);
    expect(row.value).toBe("Queer");
    expect(buildEditRows("basic", context).some((row) => row.key === "orientation")).toBe(false);
    expect(
      buildEditRow("orientationSelections", {
        ...context,
        profile: { ...context.profile, orientation: "Bisexual", orientationSelections: [] },
      }).value,
    ).toBe("Bisexual");
    expect(row.editor).toMatchObject({ kind: "multi", max: 5, searchable: true });
    expect(buildEditRow("roles", context).editor).toMatchObject({ kind: "multi", max: 5 });
    expect(
      patchFor(
        "orientationSelections",
        { kind: "multi", value: ["Queer", "Asexual"] },
        context.profile,
      ),
    ).toEqual({ orientation: null, orientationSelections: ["Queer", "Asexual"] });
    expect(
      buildEditRows("basic", { ...context, profile: { ...context.profile, country: "NG" } }).some(
        (row) => row.key === "orientationSelections",
      ),
    ).toBe(false);
  });
  it("lays out each section in Figma order", () => {
    expect(SECTION_ROWS.basic).toEqual([
      "username",
      "displayName",
      "bio",
      "gender",
      "orientationSelections",
      "dateOfBirth",
      "nationality",
      "relationshipStatus",
    ]);
    // Who sees the profile moved to Settings → Privacy.
    expect(buildEditRows("privacy", ctx).map((r) => r.key)).toEqual(["socialLinks"]);
  });

  it("offers the verified badge switch only to a verified member", () => {
    const verified = { ...ctx, profile: { ...profile, identityVerified: true } };
    expect(buildEditRows("privacy", verified).map((r) => r.key)).toContain("verifiedBadge");
    expect(buildEditRow("verifiedBadge", verified)).toMatchObject({
      value: "show",
      editor: { kind: "single", value: "show" },
    });
    expect(patchFor("verifiedBadge", { kind: "single", value: "hide" }, profile)).toEqual({
      showVerifiedBadge: false,
    });
    expect(patchFor("verifiedBadge", { kind: "single", value: "show" }, profile)).toEqual({
      showVerifiedBadge: true,
    });
  });

  it("formats the display values from the profile", () => {
    expect(valuesOf("basic")).toEqual({
      username: "@Nene",
      displayName: "Naughty Neze",
      bio: "Chill",
      gender: "Female",
      dateOfBirth: "26 Mar 1998",
      nationality: "Nigeria",
      relationshipStatus: "Single",
    });
    expect(valuesOf("kinks")).toEqual({
      roles: "Dominant",
      kinks: "Bondage, Latex",
      lookingFor: null,
      limits: null,
    });
    expect(valuesOf("location")).toEqual({
      country: "Nigeria",
      state: "Delta State",
      city: "Abraka",
      occupation: null,
      languages: "English",
    });
    expect(valuesOf("privacy")).toEqual({ socialLinks: "Facebook" });
  });

  it("carries the 30-day locks and the picker lists into the editors", () => {
    expect(buildEditRow("username", ctx).editor).toMatchObject({
      kind: "text",
      value: "Nene",
      format: "username",
      lockedUntil: "2026-10-01T00:00:00.000Z",
    });
    expect(buildEditRow("displayName", ctx).editor).toMatchObject({
      kind: "text",
      lockedUntil: null,
    });
    expect(buildEditRow("dateOfBirth", ctx).editor).toEqual({
      kind: "date",
      value: "1998-03-26",
      max: "2008-09-12",
    });
    const nationality = buildEditRow("nationality", ctx).editor;
    if (nationality.kind !== "single") throw new Error("nationality should be a single picker");
    expect(nationality.options.length).toBeGreaterThan(190);
    expect(nationality.options.find((o) => o.value === "NG")?.label).toBe("Nigeria");
    expect(nationality.searchable).toBe(true);
    expect(buildEditRow("kinks", ctx).editor).toMatchObject({
      kind: "multi",
      max: 20,
      searchable: true,
    });
    const state = buildEditRow("state", ctx).editor;
    if (state.kind === "single") expect(state.options.map((o) => o.value)).toContain("Delta");
    // The state's towns load separately; a town the list lacks can be typed in.
    expect(buildEditRow("city", ctx).editor).toMatchObject({ options: [], custom: true });
    expect(buildEditRow("city", { ...ctx, cityOptions: ["Abraka", "Warri"] }).editor).toEqual({
      kind: "single",
      value: "Abraka",
      options: [
        { value: "Abraka", label: "Abraka" },
        { value: "Warri", label: "Warri" },
      ],
      searchable: true,
      custom: true,
    });
    const noState = buildEditRow("city", {
      ...ctx,
      profile: { ...profile, state: null },
      cityOptions: ["Abraka"],
    }).editor;
    if (noState.kind === "single") expect(noState.options).toEqual([]);
    expect(buildEditRow("socialLinks", ctx).editor).toEqual({
      kind: "links",
      value: { facebook: "https://facebook.com/nene", x: "" },
    });
  });
});

describe("sexuality row", () => {
  it("offers the API's list after a choice that clears it, and saves that as null", () => {
    const profile = { ...ctx.profile, country: "KE" };
    const row = buildEditRow("orientation", { ...ctx, profile });
    expect(row.value).toBeNull();
    expect(row.editor).toEqual({
      kind: "single",
      value: null,
      searchable: false,
      options: [
        { value: "", label: "Prefer not to say" },
        { value: "Straight", label: "Straight" },
        { value: "Bisexual", label: "Bisexual" },
      ],
    });
    const chosen = { ...ctx, profile: { ...profile, orientation: "Bisexual" } };
    expect(buildEditRow("orientation", chosen).value).toBe("Bisexual");
    expect(patchFor("orientation", { kind: "single", value: "Straight" }, profile)).toEqual({
      orientation: "Straight",
    });
    expect(patchFor("orientation", { kind: "single", value: "" }, profile)).toEqual({
      orientation: null,
    });
  });
});

describe("drafts", () => {
  it("starts from the current value and knows when it changed", () => {
    const editor = buildEditRow("kinks", ctx).editor;
    const draft = initialDraft(editor);
    expect(draft).toEqual({ kind: "multi", value: ["Bondage", "Latex"] });
    expect(draftChanged(editor, draft)).toBe(false);
    expect(draftChanged(editor, { kind: "multi", value: ["Bondage"] })).toBe(true);
  });

  it("validates before the API does", () => {
    const username = buildEditRow("username", ctx).editor;
    expect(validateDraft(username, { kind: "text", value: "@sir.tega" })).toBeNull();
    expect(validateDraft(username, { kind: "text", value: "no way" })).toBe("username");
    const displayName = buildEditRow("displayName", ctx).editor;
    expect(validateDraft(displayName, { kind: "text", value: "  " })).toBe("required");
    expect(validateDraft(displayName, { kind: "text", value: "ab" })).toBe("tooShort");
    const bio = buildEditRow("bio", ctx).editor;
    expect(validateDraft(bio, { kind: "textarea", value: "x".repeat(501) })).toBe("tooLong");
    expect(validateDraft(bio, { kind: "textarea", value: "" })).toBeNull();
    const dob = buildEditRow("dateOfBirth", ctx).editor;
    expect(validateDraft(dob, { kind: "date", value: "2010-01-01" })).toBe("underage");
    expect(validateDraft(dob, { kind: "date", value: "" })).toBe("required");
    expect(validateDraft(dob, { kind: "date", value: "2000-01-01" })).toBeNull();
    const roles = buildEditRow("roles", ctx).editor;
    expect(validateDraft(roles, { kind: "multi", value: Array<string>(11).fill("Switch") })).toBe(
      "tooMany",
    );
    const links = buildEditRow("socialLinks", ctx).editor;
    expect(
      validateDraft(links, { kind: "links", value: { facebook: "facebook.com/x", x: "" } }),
    ).toBe("https");
    expect(
      validateDraft(links, { kind: "links", value: { facebook: "", x: "https://x.com/nene" } }),
    ).toBeNull();
  });

  it("builds the PATCH body per row (state resets the area, both keep the location line)", () => {
    expect(patchFor("bio", { kind: "textarea", value: "  " }, profile)).toEqual({ bio: null });
    expect(patchFor("kinks", { kind: "multi", value: ["Latex"] }, profile)).toEqual({
      interests: ["Latex"],
    });
    expect(patchFor("state", { kind: "single", value: "Lagos" }, profile)).toEqual({
      state: "Lagos",
      city: null,
      location: "Lagos State, Nigeria",
    });
    expect(patchFor("city", { kind: "single", value: "Warri" }, profile)).toEqual({
      city: "Warri",
      location: "Warri, Delta State, Nigeria",
    });
    // A typed town nobody listed saves the same way.
    expect(patchFor("city", { kind: "single", value: " Ikota Villa " }, profile)).toEqual({
      city: "Ikota Villa",
      location: "Ikota Villa, Delta State, Nigeria",
    });
    expect(patchFor("country", { kind: "single", value: "NG" }, profile)).toEqual({
      country: "NG",
      state: null,
      city: null,
      location: null,
    });
    expect(
      patchFor(
        "socialLinks",
        { kind: "links", value: { facebook: " ", x: "https://x.com/nene" } },
        profile,
      ),
    ).toEqual({ socialLinks: { facebook: null, x: "https://x.com/nene" } });
    expect(patchFor("gender", { kind: "multi", value: ["Male", "Female"] }, profile)).toEqual({
      genders: ["Male", "Female"],
    });
    expect(patchFor("username", { kind: "text", value: "x" }, profile)).toEqual({});
    expect(usernameFromDraft({ kind: "text", value: " @Sir.Tega " })).toBe("Sir.Tega");
  });

  it("helpers: location line, adult cutoff, sorted nationalities, API error text", () => {
    expect(locationLine("Abraka", "Delta", "NG")).toBe("Abraka, Delta State, Nigeria");
    expect(locationLine("Nairobi", "Nairobi", "KE")).toBe("Nairobi, Nairobi, Kenya");
    expect(locationLine(null, null, null)).toBeNull();
    expect(adultCutoff(new Date("2026-09-12T10:00:00Z"))).toBe("2008-09-12");
    const [first, second] = nationalityOptions();
    expect(first.label.localeCompare(second.label)).toBeLessThanOrEqual(0);
    expect(fieldErrorMessage({ displayName: ["locked"] })).toBe("locked");
    expect(fieldErrorMessage({ message: "nope" })).toBe("nope");
    expect(fieldErrorMessage(null)).toBeNull();
    expect(fieldErrorMessage("plain")).toBe("plain");
  });
});

describe("profileApi + uploadProfileImage", () => {
  beforeEach(() => {
    apiGet.mockReset().mockResolvedValue({});
    apiPatch.mockReset().mockResolvedValue(profile);
    apiPost.mockReset();
    upload.mockClear();
    buildUploadSet.mockReset();
  });

  it("hits the profile endpoints", async () => {
    await profileApi.me();
    await profileApi.own();
    await profileApi.options();
    await profileApi.changeUsername("nene");
    expect(apiGet.mock.calls.map((c) => c[0])).toEqual(["/me", "/profile", "/profile/options"]);
    expect(apiPatch).toHaveBeenCalledWith("/profile/username", { username: "nene" });
  });

  it("uploads every size, variants first, then points the profile at the key", async () => {
    const original = new File([new Uint8Array(1000)], "a.jpg", { type: "image/jpeg" });
    const sm = new File([new Uint8Array(10)], "a_sm.jpg", { type: "image/jpeg" });
    const md = new File([new Uint8Array(50)], "a_md.jpg", { type: "image/jpeg" });
    buildUploadSet.mockResolvedValue({ original, variants: { sm, md } });
    apiPost.mockResolvedValue({
      key: "covers/u1/a.jpg",
      uploadUrl: "https://s3/put",
      variantUploadUrls: { sm: "https://s3/sm", md: "https://s3/md" },
      maxSizeMb: 10,
    });
    const raw = new File([new Uint8Array(5)], "raw.jpg", { type: "image/jpeg" });
    const result = await uploadProfileImage("cover", raw);
    expect(buildUploadSet).toHaveBeenCalledWith(raw, "cover");
    expect(apiPost).toHaveBeenCalledWith("/profile/upload-url", {
      kind: "cover",
      contentType: "image/jpeg",
      contentLength: 1000,
    });
    expect(upload.mock.calls).toEqual([
      ["https://s3/sm", sm],
      ["https://s3/md", md],
      ["https://s3/put", original],
    ]);
    expect(apiPatch).toHaveBeenCalledWith("/profile", { coverKey: "covers/u1/a.jpg" });
    expect(result).toBe(profile);
  });

  it("stops before uploading when even the compressed original is over the cap", async () => {
    buildUploadSet.mockResolvedValue({
      original: new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" }),
      variants: { sm: new File([], "s.jpg"), md: new File([], "m.jpg") },
    });
    apiPost.mockResolvedValue({
      key: "k",
      uploadUrl: "u",
      variantUploadUrls: { sm: "s", md: "m" },
      maxSizeMb: 5,
    });
    await expect(uploadProfileImage("avatar", new File([], "x.jpg"))).rejects.toThrow(/max 5MB/);
    expect(upload).not.toHaveBeenCalled();
    expect(apiPatch).not.toHaveBeenCalled();
  });
});

describe("a member with no saved country", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gets Nigeria's states and towns, sign-up's default, rather than Kenya's", async () => {
    const noCountry = { ...profile, country: null, state: "Lagos" };
    const state = buildEditRow("state", { ...ctx, profile: noCountry }).editor;
    if (state.kind !== "single") throw new Error("state should be a single picker");
    expect(state.options.map((o) => o.value)).toContain("Lagos");
    expect(state.options.map((o) => o.value)).not.toContain("Nairobi");

    const fetch = vi.fn(async () => new Response(JSON.stringify(["Ikeja", "Lekki"])));
    vi.stubGlobal("fetch", fetch);
    await expect(loadCityOptions(noCountry)).resolves.toEqual(["Ikeja", "Lekki"]);
    expect(fetch).toHaveBeenCalledWith("/locations/NG/lagos.json");
  });
});

describe("loadCityOptions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the towns of the member's state, and nothing without a state", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(["Abraka", "Warri"])));
    vi.stubGlobal("fetch", fetch);
    await expect(loadCityOptions(profile)).resolves.toEqual(["Abraka", "Warri"]);
    expect(fetch).toHaveBeenCalledWith("/locations/NG/delta.json");
    await expect(loadCityOptions({ ...profile, state: null })).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it("hides sexuality for Nigerian profiles without changing saved values", () => {
  const local = { ...ctx, profile: { ...profile, country: "NG", orientation: "Bisexual" } };
  expect(buildEditRows("basic", local).some((r) => r.key === "orientation")).toBe(false);
  expect(patchFor("orientation", { kind: "single", value: "Straight" }, local.profile)).toEqual({});
  expect(local.profile.orientation).toBe("Bisexual");
  expect(
    buildEditRows("basic", { ...local, profile: { ...local.profile, country: "KE" } }).some(
      (r) => r.key === "orientationSelections",
    ),
  ).toBe(true);
});

it("offers South Africa and its provinces in Edit Profile", () => {
  const context = {
    ...ctx,
    profile: { ...profile, country: "ZA", state: "Gauteng", city: "City of Johannesburg" },
    cityOptions: ["City of Johannesburg"],
  };
  const country = buildEditRow("country", context).editor;
  const province = buildEditRow("state", context).editor;
  const municipality = buildEditRow("city", context).editor;
  expect(country.kind === "single" && country.options).toContainEqual({
    value: "ZA",
    label: "South Africa",
  });
  expect(province.kind === "single" && province.options).toHaveLength(9);
  expect(municipality.kind === "single" && municipality.options).toContainEqual({
    value: "City of Johannesburg",
    label: "City of Johannesburg",
  });
});
