/**
 * Display copy for the Members directory + public member profile.
 * Sources: Figma "Members 1" canvas + the CEO briefs for the Country page and the
 * State → Region → Kinksters page (2026-09-08), which supersede the mock where
 * they differ (back-button header, no bottom nav, tap-only region selector,
 * online-first cards, infinite scroll, coming-soon countries only via search).
 */
export const MEMBERS_COPY = {
  header: {
    brand: "KINKORD",
    tagline: "THE WORLD'S #1 KINK COMMUNITY",
    back: "Back",
  },
  common: {
    loading: "Loading…",
    error: "Something went wrong. Please try again.",
  },
  country: {
    title: "Select a Country",
    searchPlaceholder: "Search for a country",
    searchLabel: "Search for a country",
    availableHeading: "Available countries",
    resultsHeading: "Results",
    membersSuffix: "Members",
    comingSoon: "Coming Soon",
    noResults: "No country matches that search.",
  },
  state: {
    subtitle: "Choose your state to find kinksters near you",
    searchPlaceholder: "Search for a state",
    searchLabel: "Search for a state",
    membersSuffix: "Members",
    noResults: "No states match that search.",
    notAvailable: "Kinkord isn't in this country yet — it's coming soon.",
  },
  region: {
    /** "Find kinksters in Delta State." */
    subtitle: (state: string) => `Find kinksters in ${state}.`,
    selectorLabel: "Region",
    sheetTitle: "Choose a region",
    closeSheet: "Close",
    /** "Kinksters in Abraka (482)" */
    heading: (region: string, count: string) => `Kinksters in ${region} (${count})`,
    online: "Online",
    offline: "Offline",
    posts: "Posts",
    followers: "Followers",
    follow: "Follow",
    following: "Following",
    loadingMore: "Loading more kinksters…",
    end: "You’ve met everyone here — for now.",
    empty: (region: string) => `No kinksters in ${region} yet. Be the first.`,
    openProfile: (name: string) => `Open ${name}’s profile`,
    unknownState: "We don’t know that state yet.",
  },
  profile: {
    tabs: { posts: "Posts", about: "About", media: "Media", friends: "Friends" },
    follow: "Follow",
    following: "Following",
    message: "Message",
    online: "Online",
    lastSeen: (ago: string) => `Last seen ${ago}`,
    stats: { friends: "Friends", followers: "Followers", following: "Following" },
    about: {
      bio: "Bio",
      basicInfo: "Basic Info",
      age: "Age",
      gender: "Gender",
      orientation: "Orientation",
      relationship: "Relationship Status",
      bodyType: "Body Type",
      interests: "Interests",
      lookingFor: "Looking For",
      languages: "Languages",
      joined: "Joined",
      notShared: "Not shared",
    },
    empty: {
      posts: { title: "No posts yet", body: "Posts are coming soon to Kinkord." },
      media: { title: "No media yet", body: "Photo galleries are coming soon." },
      friends: {
        title: "Friends are coming soon",
        body: "Follow members you vibe with — when they follow back, you’re friends.",
      },
    },
    notFound: "We couldn’t find that member.",
    yourself: "This is you",
    editProfile: "Edit profile",
  },
  nav: {
    home: "Home",
    members: "Members",
    chat: "Chat",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings and Privacy",
    logout: "Log Out",
  },
  notifications: {
    headline: "Notifications",
    constructionLead: "Alerts are",
    constructionAccent: "on the way",
    subcopy: "Follows, messages and mentions will land here soon.",
  },
} as const;

/** Countries the directory serves today; every other country is "Coming Soon". */
export const AVAILABLE_COUNTRIES = [
  { code: "NG", name: "Nigeria", flag: "/app/flag-ng.svg" },
] as const;

/** Page size for the infinite-scrolling kinksters list. */
export const MEMBERS_PAGE_SIZE = 20;
