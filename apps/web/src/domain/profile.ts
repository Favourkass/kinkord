/**
 * Own-profile domain models for Edit Profile (Figma 1522:672) — the API payloads are
 * the source of truth; the edit screens derive rows and drafts from them.
 */

export interface SocialLinks {
  facebook?: string | null;
  x?: string | null;
}

export type ProfileVisibility = "public" | "friends";

/** GET /profile */
export interface OwnProfilePM {
  displayName: string;
  bio: string | null;
  pronouns: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  roles: string[];
  relationshipStatus: string | null;
  lookingFor: string[];
  interests: string[];
  orientation: string | null;
  bodyType: string | null;
  languages: string[];
  location: string | null;
  phone: string | null;
  phoneVerified: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
  nationality: string | null;
  occupation: string | null;
  limits: string | null;
  socialLinks: SocialLinks;
  profileVisibility: ProfileVisibility;
  displayNameChangedAt: string | null;
  /** null = a change is allowed now; otherwise when the 30-day lock lifts. */
  canChangeDisplayNameAt: string | null;
  usernameChangedAt: string | null;
  canChangeUsernameAt: string | null;
}

/** GET /me */
export interface MePM {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  displayUsername: string | null;
  twoFactorEnabled: boolean;
  /** Account creation — "Member since" on the profile. */
  createdAt: string;
}

/** GET /profile/options — every picker list, owned by the API. */
export interface ProfileOptionsPM {
  genders: readonly string[];
  relationshipStatuses: readonly string[];
  roles: readonly string[];
  kinks: readonly string[];
  lookingFor: readonly string[];
  languages: readonly string[];
  visibilities: readonly ProfileVisibility[];
  socialPlatforms: readonly ("facebook" | "x")[];
  nameChangeCooldownDays: number;
}

/** PATCH /profile/username */
export interface UsernameChangePM {
  username: string;
  displayUsername: string;
  usernameChangedAt: string | null;
  canChangeUsernameAt: string | null;
}

export type EditSectionKey = "basic" | "kinks" | "location" | "privacy";

export type EditRowKey =
  | "username"
  | "displayName"
  | "bio"
  | "gender"
  | "dateOfBirth"
  | "nationality"
  | "relationshipStatus"
  | "roles"
  | "kinks"
  | "lookingFor"
  | "limits"
  | "country"
  | "state"
  | "city"
  | "occupation"
  | "languages"
  | "socialLinks"
  | "profileVisibility";

export interface EditorOption {
  value: string;
  label: string;
}

/** What a row edits and how; built from the PMs, rendered by the editor sheet. */
export type EditorSpec =
  | {
      kind: "text";
      value: string;
      minLength: number;
      maxLength: number;
      /** Username rule (letters, digits, dot, underscore). */
      format?: "username";
      /** ISO date the 30-day lock lifts; null when editable now. */
      lockedUntil: string | null;
    }
  | { kind: "textarea"; value: string; maxLength: number }
  | { kind: "single"; value: string | null; options: EditorOption[]; searchable: boolean }
  | { kind: "multi"; value: string[]; options: EditorOption[]; max: number; searchable: boolean }
  | { kind: "date"; value: string | null; max: string }
  | { kind: "links"; value: { facebook: string; x: string } };

export type EditorDraft =
  | { kind: "text" | "textarea" | "date" | "single"; value: string }
  | { kind: "multi"; value: string[] }
  | { kind: "links"; value: { facebook: string; x: string } };

export type DraftIssue =
  "required" | "tooShort" | "tooLong" | "username" | "https" | "tooMany" | "underage";

export interface EditRowPM {
  key: EditRowKey;
  /** Display-ready current value, null when unset. */
  value: string | null;
  editor: EditorSpec;
}
