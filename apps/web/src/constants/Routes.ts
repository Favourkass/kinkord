export const Routes = {
  home: "/",
  kinkopedia: "/kinkopedia",
  about: "/about",
  team: "/about/team",
  contact: "/contact",
  invest: "/invest",
  lectures: "/lectures",
  lecture: (slug: string) => `/lectures/${slug}`,
  admin: "/admin",
  adminLogin: "/admin/login",
  adminLecturesNew: "/admin/lectures/new",
  adminLectureEdit: (id: string) => `/admin/lectures/${id}/edit`,
  signup: "/signup",
  login: "/login",
  appHome: "/home",
  messages: "/messages",
  settings: "/settings",
  /** Password + 2FA moved here from /profile (CEO, 2026-09-12: "we still need to keep the change password and co"). */
  settingsSecurity: "/settings/security",
  // Edit Profile hub (Figma 1542:30) and its five sections.
  profileEdit: "/profile/edit",
  profileEditPhotos: "/profile/edit/photos",
  profileEditBasic: "/profile/edit/basic",
  profileEditKinks: "/profile/edit/kinks",
  profileEditLocation: "/profile/edit/location",
  profileEditPrivacy: "/profile/edit/privacy",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  profile: "/profile",
  // Members directory: country -> state -> members in that state.
  members: "/members",
  membersCountry: (country: string) => `/members/${country.toLowerCase()}`,
  membersState: (country: string, state: string) =>
    `/members/${country.toLowerCase()}/${encodeURIComponent(state)}`,
  /** A state narrowed to one city / LGA — what a profile's city links to. */
  membersRegion: (country: string, state: string, region: string) =>
    `/members/${country.toLowerCase()}/${encodeURIComponent(state)}?region=${encodeURIComponent(region)}`,
  /** Another member's public profile. */
  member: (username: string) => `/u/${encodeURIComponent(username.replace(/^@/, ""))}`,
  /** People tab "See more" page (Figma 1322:25). */
  memberPeople: (username: string, tab: string) =>
    `/u/${encodeURIComponent(username.replace(/^@/, ""))}/people?tab=${encodeURIComponent(tab)}`,
  notifications: "/notifications",
  /** One post on its own — what Share hands out. */
  post: (id: string) => `/p/${encodeURIComponent(id)}`,
  /** The viewer's saved posts. */
  saved: "/saved",
} as const;
