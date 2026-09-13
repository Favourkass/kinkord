import { ALL_COUNTRY_CODES } from "@/constants/countries";
import { LAUNCH_COUNTRIES } from "@/constants/onboarding";
import type {
  DraftIssue,
  EditorDraft,
  EditorOption,
  EditorSpec,
  EditRowKey,
  EditRowPM,
  EditSectionKey,
  MePM,
  OwnProfilePM,
  ProfileOptionsPM,
  ProfileVisibility,
  SocialLinks,
  UsernameChangePM,
} from "@/domain/profile";
import { IMAGE_VARIANTS, buildUploadSet, type ImageVariant } from "@/util/image";
import { capitalize, countryName, displayState, shortDate } from "@/util/format";
import { api, uploadToPresignedUrl } from "./apiClient";
import { regionsForState, statesForCountry } from "./members.service";

/** Presigned PUT slots returned by POST /profile/upload-url — one per stored size. */
export interface UploadSlots {
  key: string;
  uploadUrl: string;
  variantUploadUrls: Record<ImageVariant, string>;
  maxSizeMb: number;
}

export type ImageKind = "avatar" | "cover";

/** PATCH /profile body — only the fields Edit Profile writes. */
export interface ProfilePatch {
  displayName?: string;
  bio?: string | null;
  gender?: string | null;
  dateOfBirth?: string;
  nationality?: string | null;
  relationshipStatus?: string | null;
  roles?: string[];
  interests?: string[];
  lookingFor?: string[];
  limits?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  location?: string | null;
  occupation?: string | null;
  languages?: string[];
  socialLinks?: SocialLinks;
  profileVisibility?: ProfileVisibility;
  avatarKey?: string;
  coverKey?: string;
}

export const profileApi = {
  me: () => api.get<MePM>("/me"),
  own: () => api.get<OwnProfilePM>("/profile"),
  options: () => api.get<ProfileOptionsPM>("/profile/options"),
  update: (patch: ProfilePatch) => api.patch<OwnProfilePM>("/profile", patch),
  changeUsername: (username: string) =>
    api.patch<UsernameChangePM>("/profile/username", { username }),
  uploadUrl: (kind: ImageKind, contentType: string, contentLength: number) =>
    api.post<UploadSlots>("/profile/upload-url", { kind, contentType, contentLength }),
};

/**
 * Upload pipeline shared by every screen that changes a photo: shrink to what the UI
 * shows (512px avatars, 1600px covers), derive the stored sizes, upload variants first
 * (so a failure leaves the previous photo intact), then point the profile at the key.
 */
export async function uploadProfileImage(kind: ImageKind, rawFile: File): Promise<OwnProfilePM> {
  const { original, variants } = await buildUploadSet(rawFile, kind);
  // Declaring the byte size lets the API sign it, so S3 refuses a different body.
  const spec = await profileApi.uploadUrl(kind, original.type, original.size);
  if (original.size > spec.maxSizeMb * 1024 * 1024) {
    throw new Error(`Image is too large — max ${spec.maxSizeMb}MB.`);
  }
  await Promise.all(
    IMAGE_VARIANTS.map((v) => uploadToPresignedUrl(spec.variantUploadUrls[v], variants[v])),
  );
  await uploadToPresignedUrl(spec.uploadUrl, original);
  return profileApi.update(kind === "avatar" ? { avatarKey: spec.key } : { coverKey: spec.key });
}

/** Rows per section, in Figma order (1542:301, Kinks per CEO brief, 1641:642, 1642:36). */
export const SECTION_ROWS: Record<EditSectionKey, EditRowKey[]> = {
  basic: [
    "username",
    "displayName",
    "bio",
    "gender",
    "dateOfBirth",
    "nationality",
    "relationshipStatus",
  ],
  kinks: ["roles", "kinks", "lookingFor", "limits"],
  location: ["country", "state", "city", "occupation", "languages"],
  privacy: ["socialLinks", "profileVisibility"],
};

/** Same rule as the API / Better Auth username plugin. */
export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

const HTTPS_RE = /^https:\/\/\S+$/;

/** Latest birth date that is 18+ today, as YYYY-MM-DD. */
export function adultCutoff(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

const joinList = (xs: readonly string[] | null | undefined) =>
  xs && xs.length ? xs.join(", ") : null;

const plain = (xs: readonly string[]): EditorOption[] => xs.map((v) => ({ value: v, label: v }));

/** Every country for the nationality picker, by English name. */
export function nationalityOptions(): EditorOption[] {
  return ALL_COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code) ?? code })).sort(
    (a, b) => a.label.localeCompare(b.label),
  );
}

/** "Abraka, Delta State, Nigeria" — the free-text whereabouts line kept in sync with the picks. */
export function locationLine(
  city: string | null,
  state: string | null,
  country: string | null,
): string | null {
  const parts = [city, displayState(state), countryName(country)].filter((p): p is string =>
    Boolean(p),
  );
  return parts.length ? parts.join(", ") : null;
}

export interface EditRowsContext {
  profile: OwnProfilePM;
  me: MePM;
  options: ProfileOptionsPM;
  now?: Date;
}

/** Display value + editor for one row. */
export function buildEditRow(key: EditRowKey, ctx: EditRowsContext): EditRowPM {
  const { profile, me, options } = ctx;
  const now = ctx.now ?? new Date();
  const text = (
    value: string | null | undefined,
    minLength: number,
    maxLength: number,
    lockedUntil: string | null = null,
    format?: "username",
  ): EditorSpec => ({
    kind: "text",
    value: value ?? "",
    minLength,
    maxLength,
    lockedUntil,
    format,
  });
  const single = (value: string | null, opts: EditorOption[], searchable = false): EditorSpec => ({
    kind: "single",
    value,
    options: opts,
    searchable,
  });
  const multi = (value: string[], opts: readonly string[], max: number, searchable = false) =>
    ({ kind: "multi", value, options: plain(opts), max, searchable }) satisfies EditorSpec;
  const country = profile.country ?? LAUNCH_COUNTRIES[0].code;

  switch (key) {
    case "username": {
      const handle = me.displayUsername ?? me.username ?? "";
      return {
        key,
        value: handle ? `@${handle}` : null,
        editor: text(handle, 3, 30, profile.canChangeUsernameAt, "username"),
      };
    }
    case "displayName":
      return {
        key,
        value: profile.displayName || null,
        editor: text(profile.displayName, 3, 30, profile.canChangeDisplayNameAt),
      };
    case "bio":
      return {
        key,
        value: profile.bio?.trim() || null,
        editor: { kind: "textarea", value: profile.bio ?? "", maxLength: 500 },
      };
    case "gender":
      return {
        key,
        value: capitalize(profile.gender) || null,
        editor: single(capitalize(profile.gender) || null, plain(options.genders)),
      };
    case "dateOfBirth":
      return {
        key,
        value: shortDate(profile.dateOfBirth),
        editor: { kind: "date", value: profile.dateOfBirth, max: adultCutoff(now) },
      };
    case "nationality":
      return {
        key,
        value: countryName(profile.nationality),
        editor: single(profile.nationality, nationalityOptions(), true),
      };
    case "relationshipStatus":
      return {
        key,
        value: profile.relationshipStatus,
        editor: single(profile.relationshipStatus, plain(options.relationshipStatuses)),
      };
    case "roles":
      return {
        key,
        value: joinList(profile.roles),
        editor: multi(profile.roles, options.roles, 10),
      };
    case "kinks":
      return {
        key,
        value: joinList(profile.interests),
        editor: multi(profile.interests, options.kinks, 20, true),
      };
    case "lookingFor":
      return {
        key,
        value: joinList(profile.lookingFor),
        editor: multi(profile.lookingFor, options.lookingFor, 10),
      };
    case "limits":
      return {
        key,
        value: profile.limits?.trim() || null,
        editor: { kind: "textarea", value: profile.limits ?? "", maxLength: 500 },
      };
    case "country":
      return {
        key,
        value: countryName(profile.country),
        editor: single(
          profile.country,
          LAUNCH_COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
        ),
      };
    case "state":
      return {
        key,
        value: displayState(profile.state) || null,
        editor: single(profile.state, plain(statesForCountry(country)), true),
      };
    case "city":
      return {
        key,
        value: profile.city,
        editor: single(
          profile.city,
          profile.state ? plain(regionsForState(country, profile.state)) : [],
          true,
        ),
      };
    case "occupation":
      return { key, value: profile.occupation, editor: text(profile.occupation, 0, 80) };
    case "languages":
      return {
        key,
        value: joinList(profile.languages),
        editor: multi(profile.languages, options.languages, 10, true),
      };
    case "socialLinks": {
      const links = profile.socialLinks ?? {};
      return {
        key,
        value: joinList(
          options.socialPlatforms
            .filter((p) => Boolean(links[p]))
            .map((p) => (p === "x" ? "X" : capitalize(p))),
        ),
        editor: { kind: "links", value: { facebook: links.facebook ?? "", x: links.x ?? "" } },
      };
    }
    case "profileVisibility":
      return {
        key,
        value: profile.profileVisibility,
        editor: single(profile.profileVisibility, plain(options.visibilities)),
      };
  }
}

export function buildEditRows(section: EditSectionKey, ctx: EditRowsContext): EditRowPM[] {
  return SECTION_ROWS[section].map((key) => buildEditRow(key, ctx));
}

export function initialDraft(editor: EditorSpec): EditorDraft {
  switch (editor.kind) {
    case "text":
    case "textarea":
      return { kind: editor.kind, value: editor.value };
    case "date":
    case "single":
      return { kind: editor.kind, value: editor.value ?? "" };
    case "multi":
      return { kind: "multi", value: [...editor.value] };
    case "links":
      return { kind: "links", value: { ...editor.value } };
  }
}

export function draftChanged(editor: EditorSpec, draft: EditorDraft): boolean {
  return JSON.stringify(initialDraft(editor)) !== JSON.stringify(draft);
}

/** Client-side check before the API's; the API remains authoritative. */
export function validateDraft(editor: EditorSpec, draft: EditorDraft): DraftIssue | null {
  if (editor.kind === "text" && draft.kind === "text") {
    const v = draft.value.trim();
    if (editor.format === "username")
      return USERNAME_RE.test(v.replace(/^@/, "")) ? null : "username";
    if (v.length < editor.minLength) return v.length === 0 ? "required" : "tooShort";
    if (v.length > editor.maxLength) return "tooLong";
    return null;
  }
  if (editor.kind === "textarea" && draft.kind === "textarea") {
    return draft.value.length > editor.maxLength ? "tooLong" : null;
  }
  if (editor.kind === "date" && draft.kind === "date") {
    if (!draft.value) return "required";
    return draft.value > editor.max ? "underage" : null;
  }
  if (editor.kind === "multi" && draft.kind === "multi") {
    return draft.value.length > editor.max ? "tooMany" : null;
  }
  if (editor.kind === "links" && draft.kind === "links") {
    const bad = Object.values(draft.value).some((v) => v.trim() && !HTTPS_RE.test(v.trim()));
    return bad ? "https" : null;
  }
  return null;
}

const textOf = (draft: EditorDraft) => (typeof draft.value === "string" ? draft.value.trim() : "");
const listOf = (draft: EditorDraft) => (draft.kind === "multi" ? draft.value : []);

/** The handle to send to PATCH /profile/username. */
export const usernameFromDraft = (draft: EditorDraft) => textOf(draft).replace(/^@/, "");

/** PATCH /profile body for a saved row (username is a separate endpoint). */
export function patchFor(key: EditRowKey, draft: EditorDraft, profile: OwnProfilePM): ProfilePatch {
  const t = textOf(draft);
  switch (key) {
    case "username":
      return {};
    case "displayName":
      return { displayName: t };
    case "bio":
      return { bio: t || null };
    case "limits":
      return { limits: t || null };
    case "occupation":
      return { occupation: t || null };
    case "gender":
      return { gender: t || null };
    case "dateOfBirth":
      return { dateOfBirth: t };
    case "nationality":
      return { nationality: t || null };
    case "relationshipStatus":
      return { relationshipStatus: t || null };
    case "roles":
      return { roles: listOf(draft) };
    case "kinks":
      return { interests: listOf(draft) };
    case "lookingFor":
      return { lookingFor: listOf(draft) };
    case "languages":
      return { languages: listOf(draft) };
    case "country":
      // A new country invalidates the state and area picked under the old one.
      return { country: t || null, state: null, city: null, location: null };
    case "state":
      return {
        state: t || null,
        city: null,
        location: locationLine(null, t || null, profile.country),
      };
    case "city":
      return { city: t || null, location: locationLine(t || null, profile.state, profile.country) };
    case "socialLinks": {
      const links = draft.kind === "links" ? draft.value : { facebook: "", x: "" };
      return {
        socialLinks: { facebook: links.facebook.trim() || null, x: links.x.trim() || null },
      };
    }
    case "profileVisibility":
      return { profileVisibility: (t || "public") as ProfileVisibility };
  }
}

/**
 * Human message from an API error body: Nest field errors ({ field: [msgs] }), a
 * plain { message }, or nothing we can show.
 */
export function fieldErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" ? body : null;
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  const messages = Object.values(record)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is string => typeof v === "string");
  return messages.length ? messages.join(" ") : null;
}
