/**
 * Option lists for Edit Profile (CEO brief, 2026-09-12: "only limits is writable, the
 * rest, we give them options"). The API is the source of truth: it validates writes
 * against these and serves them to the web app via GET /profile/options, so the lists
 * can change without a web release. Order is the order members see.
 */

export const GENDERS = ["Male", "Female"] as const;
export type Gender = (typeof GENDERS)[number];

export const RELATIONSHIP_STATUSES = [
  "Single",
  "In a Relationship",
  "Married",
  "Engaged",
  "Dating",
  "Seeing Someone",
  "It's Complicated",
  "Separated",
  "Divorced",
  "Widowed",
  "Open Relationship",
  "Polyamorous",
  "In a dynamics",
  "Monogamous",
  "In a TPE",
  "Not searching",
  "Head of Household (HoH)",
] as const;

export const KINK_ROLES = [
  "Ageplayer",
  "Bottom",
  "Brat",
  "Caregiver",
  "Cuckold",
  "Dominant",
  "Domme",
  "Exhibitionist",
  "Masochist",
  "Master",
  "Mistress",
  "Owner",
  "Pet",
  "Primal",
  "Sadist",
  "Slave",
  "Submissive",
  "Switch",
  "Top",
  "Voyeur",
] as const;

/**
 * Roles offered by the signup wizard before the 2026-09-12 list. Still accepted on
 * write so a member on a not-yet-refreshed app build can finish signing up; no longer
 * offered anywhere.
 */
export const LEGACY_KINK_ROLES = [
  "Handler",
  "Brat Tamer",
  "Rigger",
  "Rope Bunny",
  "Little",
  "Curious",
] as const;

/** What PATCH /profile accepts for `roles`: the offered list plus the legacy names. */
export const ACCEPTED_KINK_ROLES = [...KINK_ROLES, ...LEGACY_KINK_ROLES] as const;

export const KINKS = [
  "Anal play",
  "Auralism",
  "Blindfolds",
  "Body worship",
  "Bondage",
  "Boot/shoe worship",
  "Brat taming",
  "Breast/nipple play",
  "Chastity",
  "Collar and leash",
  "Consensual non-consent",
  "Cuckolding",
  "Cum play",
  "Degradation (verbal)",
  "Denial / orgasm control",
  "Dirty talk",
  "Discipline",
  "Dom/sub dynamics",
  "Edging",
  "Exhibitionism (private/legal settings)",
  "Face sitting",
  "Flogging / impact play",
  "Foot fetish",
  "Forced orgasm",
  "Gags",
  "Handcuffs / restraints",
  "Impact play (spanking, paddling, etc.)",
  "Kneeling / protocol",
  "Latex",
  "Leather",
  "Lingerie / clothing control",
  "Masochism",
  "Medical play (adult roleplay)",
  "Nipple clamps / play",
  "Orgasm control",
  "Pegging",
  "Pet play",
  "Praise kink",
  "Punishment",
  "Roleplay (adult scenarios)",
  "Rope bondage",
  "Sadism",
  "Sensory deprivation",
  "Service submission",
  "Spanking",
  "Submission",
  "Tease and denial",
  "Tickling",
  "Uniform play",
  "Wax play",
] as const;

export const LOOKING_FOR = [
  "Friendship",
  "Dating & Relationship",
  "Long-Term Partnership",
  "Sexual Partner",
  "Kink play Partner",
  "Events",
  "Kink/sex education",
  "Vanilla dating",
  "Community & Socializing",
  "Mentorship / Guidance",
] as const;

/** Nigeria-first, then widely spoken languages; free text is not accepted. */
export const LANGUAGES = [
  "English",
  "Pidgin",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Edo",
  "Efik",
  "Esan",
  "Fulfulde",
  "Ibibio",
  "Idoma",
  "Igala",
  "Ijaw",
  "Isoko",
  "Itsekiri",
  "Kanuri",
  "Nupe",
  "Tiv",
  "Urhobo",
  "Arabic",
  "French",
  "German",
  "Hindi",
  "Italian",
  "Mandarin",
  "Portuguese",
  "Spanish",
  "Swahili",
] as const;

export const PROFILE_VISIBILITIES = ["public", "friends"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const SOCIAL_PLATFORMS = ["facebook", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Display name and username can each change once in this window (CEO brief). */
export const NAME_CHANGE_COOLDOWN_DAYS = 30;

/** Payload of GET /profile/options. */
export const PROFILE_OPTIONS = {
  genders: GENDERS,
  relationshipStatuses: RELATIONSHIP_STATUSES,
  roles: KINK_ROLES,
  kinks: KINKS,
  lookingFor: LOOKING_FOR,
  languages: LANGUAGES,
  visibilities: PROFILE_VISIBILITIES,
  socialPlatforms: SOCIAL_PLATFORMS,
  nameChangeCooldownDays: NAME_CHANGE_COOLDOWN_DAYS,
} as const;
