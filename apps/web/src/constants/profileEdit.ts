import type { EditRowKey, EditSectionKey, ProfileVisibility } from "@/domain/profile";

/** Figma-exported glyphs for the Edit Profile hub rows (1542:30/164). */
export const SECTION_ICONS: Record<EditSectionKey | "photos", string> = {
  photos: "/app/profile/edit-photos.svg",
  basic: "/app/profile/edit-basic.svg",
  kinks: "/app/profile/edit-kink.svg",
  location: "/app/profile/edit-location.svg",
  privacy: "/app/profile/edit-privacy.svg",
};

/** Row glyphs from the section frames (1542:301, 1641:642, 1642:36) and the About cards. */
export const ROW_ICONS: Record<EditRowKey, string> = {
  username: "/app/profile/edit/row-username.svg",
  displayName: "/app/profile/edit/row-display-name.svg",
  bio: "/app/profile/edit/row-bio.svg",
  gender: "/app/profile/edit/row-gender.svg",
  dateOfBirth: "/app/profile/edit/row-dob.svg",
  nationality: "/app/profile/edit/row-nationality.svg",
  relationshipStatus: "/app/profile/edit/row-relationship.svg",
  roles: "/app/profile/about-roles.svg",
  kinks: "/app/profile/about-kinks.svg",
  lookingFor: "/app/profile/about-looking-for.svg",
  limits: "/app/profile/about-limits.svg",
  country: "/app/profile/edit/row-country.svg",
  state: "/app/profile/edit/row-state.svg",
  city: "/app/profile/icon-location-outline.svg",
  occupation: "/app/profile/edit/row-occupation.svg",
  languages: "/app/profile/edit/row-languages.svg",
  socialLinks: "/app/profile/edit/row-social-links.svg",
  profileVisibility: "/app/profile/edit/row-visibility.svg",
};

export const PROFILE_EDIT_COPY = {
  title: "Edit Profile",
  back: "Back",
  hub: {
    subtitle: "Update your Profile Information and Make your Profile Truly Yours",
    tier: "Basic Member",
    changePhoto: "Change profile photo",
    sections: {
      photos: {
        title: "Photos & Media",
        subtitle: "Update your Profile Picture, cover Photo and Gallery.",
      },
      basic: { title: "Basic Information", subtitle: "Update your Personal details and identity." },
      kinks: {
        title: "Kink & Preference",
        subtitle: "Update your Interests, role and preference.",
      },
      location: {
        title: "Location & Personal Details",
        subtitle: "Update your Location, occupation and Languages.",
      },
      privacy: {
        title: "Privacy & Socials",
        subtitle: "Manage your social links and privacy settings.",
      },
    },
  },
  photos: {
    heading: "Photos & Media",
    subtitle: "Update your profile picture and cover photo.",
    avatar: {
      title: "Profile Photo",
      subtitle: "Shown on your profile, posts and the members list.",
      action: "Edit",
      change: "Change profile photo",
    },
    cover: {
      title: "Cover Photo",
      subtitle: "The banner across the top of your profile.",
      action: "Edit",
      change: "Change cover photo",
    },
    hint: (mb: number) => `JPG, PNG or WebP up to ${mb}MB`,
    uploading: "Uploading…",
    savedAvatar: "Profile photo updated.",
    savedCover: "Cover photo updated.",
  },
  sections: {
    basic: {
      heading: "Basic Information",
      subtitle: "Update your Personal details and identity.",
    },
    kinks: {
      heading: "Kink & Preference",
      subtitle: "Update your Interests, role and preference.",
    },
    location: {
      heading: "Location & Personal Details",
      subtitle: "Update your Location, occupation and Languages.",
    },
    privacy: {
      heading: "Privacy & Socials",
      subtitle: "Manage your privacy and social connections",
    },
  } satisfies Record<EditSectionKey, { heading: string; subtitle: string }>,
  rows: {
    username: {
      title: "Username",
      help: "Letters, numbers, dots and underscores. You can change it once every 30 days.",
    },
    displayName: {
      title: "Display Name",
      help: "How your name appears across Kinkord. You can change it once every 30 days.",
    },
    bio: { title: "Bio", help: "Up to 500 characters." },
    gender: { title: "Gender", help: null },
    dateOfBirth: { title: "Date of Birth", help: "You must be 18 or older." },
    nationality: { title: "Nationality", help: null },
    relationshipStatus: { title: "Relationship Status", help: null },
    roles: { title: "Roles", help: "Pick up to 10." },
    kinks: { title: "Kinks & Interests", help: "Pick up to 20." },
    lookingFor: { title: "Looking For", help: "Pick up to 10." },
    limits: { title: "Limits", help: "Your hard limits — the things you won't do." },
    country: { title: "Country", help: null },
    state: { title: "State / Region", help: "Changing your state clears your area." },
    city: { title: "Area / LGA", help: "Members in your area find you first." },
    occupation: { title: "Occupation", help: null },
    languages: { title: "Language Spoken", help: "Pick up to 10." },
    socialLinks: { title: "Social Media Links", help: "Public links shown on your profile." },
    profileVisibility: { title: "Profile Visibility", help: null },
  } satisfies Record<EditRowKey, { title: string; help: string | null }>,
  visibility: {
    public: { label: "Public", help: "Every member can see your full profile." },
    friends: {
      label: "Friends only",
      help: "Only friends (you follow each other) see your About details.",
    },
  } satisfies Record<ProfileVisibility, { label: string; help: string }>,
  links: {
    facebook: { label: "Facebook", placeholder: "https://facebook.com/yourname" },
    x: { label: "X", placeholder: "https://x.com/yourname" },
  },
  placeholders: {
    bio: "Tell the community about yourself",
    limits: "e.g. No blood, no permanent marks",
    occupation: "e.g. Entrepreneur",
    username: "yourname",
    displayName: "Your display name",
  },
  empty: "Not set",
  notLinked: "Not linked",
  save: "Save",
  cancel: "Cancel",
  saving: "Saving…",
  saved: "Saved.",
  close: "Close",
  search: "Search",
  selected: (n: number, max: number) => `${n}/${max} selected`,
  lockedUntil: (date: string) => `Locked — you can change this again on ${date}.`,
  issues: {
    required: "This can't be empty.",
    tooShort: "Too short.",
    tooLong: "Too long.",
    username: "Use 3–30 letters, numbers, dots or underscores.",
    https: "Links must start with https://",
    tooMany: "You've picked too many.",
    underage: "You must be 18 or older.",
  },
  loading: "Loading your profile…",
  loadError: "Could not load your profile. Refresh to try again.",
  saveError: "Could not save. Check your details.",
  uploadError: "Upload failed.",
} as const;

export const SECURITY_COPY = {
  title: "Security & 2FA",
  subtitle: "Your password and two-factor authentication.",
  twoFactor: {
    heading: "Two-factor authentication",
    on: "ON",
    off: "OFF",
    description: "Works with Google Authenticator, Authy or any authenticator app — free.",
    passwordToEnable: "Confirm password to enable",
    passwordToDisable: "Confirm password to disable",
    enable: "Enable 2FA",
    disable: "Disable 2FA",
    instructions: "1. Scan this QR with your authenticator app · 2. Enter the 6-digit code",
    qrAlt: "2FA QR code",
    backupCodes: "Backup codes (save these)",
    confirm: "Confirm & turn on",
  },
  password: {
    heading: "Change password",
    current: "Current password",
    next: "New password",
    helper: "10+ characters, letters & numbers.",
    submit: "Change password",
  },
  loadError: "Could not load your account. Refresh to try again.",
} as const;
