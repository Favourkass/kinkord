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
    tabs: { posts: "Posts", about: "About", media: "Media", people: "People" },
    follow: "Follow",
    following: "Following",
    message: "Message",
    /** Own profile (Figma 1167:552): gold "Add to story" (inert until stories) + black "Edit profile". */
    addToStory: "Add to story",
    editProfile: "Edit profile",
    /** "Gift is not working for now" (CEO, 2026-09-12) — shown, never active. */
    gift: "Gift",
    comingSoon: "Coming soon",
    online: "Online",
    lastSeen: (ago: string) => `Last seen ${ago}`,
    stats: { friends: "Friends", followers: "Followers", following: "Following" },
    /** About tab cards (Figma 1256:800 + Profile Sections Design). */
    about: {
      aboutMe: "About Me",
      personal: "Personal Information",
      age: "Age",
      dateOfBirth: "Date of Birth",
      gender: "Gender",
      location: "Location",
      relationship: "Relationship Status",
      nationality: "Nationality",
      occupation: "Occupation",
      languages: "Languages",
      roles: "Roles",
      kinks: "Kinks & Interests",
      lookingFor: "Looking For",
      limits: "Limits",
      groups: "Groups & Communities",
      noGroups: "Not in any groups yet.",
      social: "Social Links",
      noSocial: "No links added yet.",
      platforms: { facebook: "Facebook", x: "X (Twitter)" },
      verification: "Verification Status",
      verified: { basic: "Basic Verified", none: "Not verified yet" },
      verifiedDetail: (email: boolean, phone: boolean) =>
        email && phone
          ? "Email & Phone Verified"
          : email
            ? "Email Verified"
            : phone
              ? "Phone Verified"
              : "Verify your email to get the badge",
      tagline: "More than a community... It's a lifestyle.",
      memberSince: (date: string) => `Member since ${date}`,
      notShared: "Not shared",
      privateNotice: "This member only shares their details with friends.",
    },
    people: {
      tabs: {
        all: (n: string) => `Friends (${n})`,
        followers: (n: string) => `Followers (${n})`,
        following: (n: string) => `Following (${n})`,
        suggested: "Suggested",
        mutual: (n: string) => `Mutual (${n})`,
      },
      friendsPill: "Friends",
      follow: "Follow",
      following: "Following",
      more: "More",
      seeMore: "See more",
      empty: {
        all: "No friends yet.",
        followers: "No followers yet.",
        following: "Not following anyone yet.",
        suggested: "No suggestions yet.",
        mutual: "No mutual friends yet.",
      },
      pageTitle: (name: string) => `${name} · People`,
      back: "Back",
      end: "That's everyone.",
      loadingMore: "Loading more…",
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
      filters: { all: "All", profile: "Profile Photo", photos: "Photos", videos: "Videos" },
      empty: "No photos yet.",
      featured: "Featured",
      lightbox: {
        close: "Close",
        delete: "Delete photo",
        confirm: "Delete this photo? This can't be undone.",
        confirmYes: "Delete",
        cancel: "Cancel",
        deleting: "Deleting…",
        current: "In use on your profile",
      },
    },
    notFound: "We couldn’t find that member.",
    yourself: "This is you",
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
