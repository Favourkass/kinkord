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
  messagesWith: (username: string) =>
    `/messages?u=${encodeURIComponent(username.replace(/^@/, ""))}`,
  settings: "/settings",
  profileEdit: "/profile/edit",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  profile: "/profile",
  profilePeople: (tab?: string) =>
    tab ? `/profile/people?tab=${encodeURIComponent(tab)}` : "/profile/people",
  // Members directory: country -> state -> members in that state.
  members: "/members",
  membersCountry: (country: string) => `/members/${country.toLowerCase()}`,
  membersState: (country: string, state: string) =>
    `/members/${country.toLowerCase()}/${encodeURIComponent(state)}`,
  /** Another member's public profile. */
  member: (username: string) => `/u/${encodeURIComponent(username.replace(/^@/, ""))}`,
  memberPeople: (username: string, tab?: string) =>
    tab
      ? `/u/${encodeURIComponent(username.replace(/^@/, ""))}/people?tab=${encodeURIComponent(tab)}`
      : `/u/${encodeURIComponent(username.replace(/^@/, ""))}/people`,
  notifications: "/notifications",
} as const;
