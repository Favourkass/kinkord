/**
 * Display copy for the Members directory + public member profile.
 * Source of truth: Figma "Members 1" canvas (node 864:30) — copy is verbatim from
 * the frames; behaviours that the frames don't show (online-first ordering,
 * infinite scroll, coming-soon search) follow the CEO briefs of 2026-09-08.
 */
export const MEMBERS_COPY = {
  header: { brand: "KINKORD", menu: "Open menu" },
  common: {
    loading: "Loading…",
    error: "Something went wrong. Please try again.",
  },
  country: {
    title: "Select a Country",
    subtitle: "Choose a country to deliver and connect with kinky people near you.",
    searchPlaceholder: "Search for a country",
    searchLabel: "Search for a country",
    availableHeading: "AVAILABLE COUNTRIES",
    resultsHeading: "RESULTS",
    membersSuffix: "Members",
    comingSoon: "COMING SOON",
    noResults: "No country matches that search.",
    banner: {
      title: "More countries coming soon!",
      body: "We’re expanding globally. Stay tuned.",
      badge: "COMING SOON",
    },
  },
  state: {
    notAvailable: "Kinkord isn’t in this country yet — it’s coming soon.",
  },
  region: {
    subtitle: "Discover like-minded members near you.",
    selectorLabel: "Region",
    /** Dropdown value before an LGA is picked: the whole state is listed. */
    allRegions: "All regions",
    searchByRegion: "Search by Region",
    sheetTitle: "Choose a region",
    /** Country page: the dropdown lists states and the whole country is shown until one is picked. */
    allStates: "All states",
    searchByState: "Search by State",
    sheetTitleStates: "Choose a state",
    closeSheet: "Close",
    found: "Members Found",
    sort: "Sort",
    sortLabel: (mode: string) => `Sort: ${mode}`,
    sortModes: { recent: "Newest", followers: "Most followed", name: "Name" },
    viewList: "List view",
    posts: "Posts",
    followers: "Followers",
    follow: "Follow",
    following: "Following",
    loadingMore: "Loading more members…",
    end: "You’ve met everyone here — for now.",
    empty: (place: string) => `No members in ${place} yet. Be the first.`,
    openProfile: (name: string) => `Open ${name}’s profile`,
    unknownState: "We don’t know that state yet.",
  },
  profile: {
    brand: "KINKORD",
    actions: { search: "Search members", more: "More options", share: "Share profile" },
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
    friends: {
      heading: "Friends",
      all: (n: string) => `All Friends (${n})`,
      mutual: (n: string) => `Mutual Friends (${n})`,
      follow: "Follow",
      following: "Following",
      more: "More",
      empty: "No friends to show yet.",
    },
    posts: {
      empty: "No posts yet.",
      like: "Like",
      comment: "Comment",
      share: "Share",
    },
    media: {
      heading: "Photos",
      count: (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`,
      filters: { all: "All", profile: "Profile", recent: "Recent" },
      empty: "No photos yet.",
      featured: "Featured",
    },
    notFound: "We couldn’t find that member.",
    yourself: "This is you",
    editProfile: "Edit profile",
    /** Desktop-only chrome (Figma desktop-profile-* frames). */
    desktop: {
      searchPlaceholder: "Search friends, kinks, groups...",
      account: "My Account",
      tagsHeading: "Profile Bio & Tags",
      friendsList: "Friends List",
      suggested: "Suggested Friends",
      add: "Add",
      added: "Added",
      noSuggestions: "No suggestions yet.",
    },
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
  { code: "NG", name: "Nigeria", flag: "/app/members/flag-ng.svg" },
] as const;

/** Page size for the infinite-scrolling members list. */
export const MEMBERS_PAGE_SIZE = 20;
