import { LAUNCH_COUNTRIES } from "./onboarding";

/**
 * Display copy for the Members directory + public member profile.
 * Source of truth: Figma "Members 1" canvas (node 864:30) — copy is verbatim from
 * the frames; behaviours that the frames don't show (online-first ordering,
 * infinite scroll, coming-soon search) follow the CEO briefs of 2026-09-08.
 */
import { BRAND_NAME } from "./landing";
export const MEMBERS_COPY = {
  header: { brand: BRAND_NAME, menu: "Open menu" },
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
    searchRegions: "Search regions / cities / towns",
    searchStates: "Search states",
    loadingRegions: "Loading regions…",
    noRegionMatch: "No matching regions",
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
    searchPlaceholder: "Search by name or @username",
    searchLabel: "Search members",
    noMatch: (query: string, place: string) => `No one in ${place} matches “${query}”.`,
    openProfile: (name: string) => `Open ${name}’s profile`,
    unknownState: "We don’t know that state yet.",
  },
  profile: {
    brand: BRAND_NAME,
    actions: { search: "Search", more: "More options", share: "Share profile" },
    tabs: { posts: "Posts", tagged: "Tagged", about: "About", media: "Media", people: "People" },
    follow: "Follow",
    following: "Following",
    message: "Message",
    /** Own profile (Figma 1167:552): gold "Add to story" (inert until stories) + black "Edit profile". */
    addToStory: "Add to story",
    editProfile: "Edit profile",
    comingSoon: "Coming soon",
    online: "Online",
    lastSeen: (ago: string) => `Last seen ${ago}`,
    stats: { friends: "Friends", followers: "Followers", following: "Following" },
    organization: "Official",
    verifiedOrganization: "Official Kinkord account",
    /** About tab cards (Figma 1256:800 + Profile Sections Design). */
    about: {
      aboutMe: "About Me",
      aboutUs: "About Us",
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
      verified: {
        identity: "Identity verified",
        basic: "Basic Verified",
        none: "Not verified yet",
      },
      identityDetail: "ID and selfie checked by Kinkord",
      /** Beside your own badge when you've hidden it from everyone else. */
      identityHidden: "Hidden from others",
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
      privateNotice: "This member keeps their About details private.",
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
      /** The Tagged tab: posts that tag this member. */
      taggedEmpty: "No tagged posts yet.",
      /** What a visitor sees where a friends-only post would be — the API simply omits it. */
      loading: "Loading posts…",
      loadMore: "Load more posts",
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
    /** What the Silver ring says when tapped, X-style. */
    silver: {
      title: "Silver Premium",
      body: "This member has the badge because they're subscribed to Silver Premium.",
      since: (when: string) => `Silver since ${when}`,
      get: "Get Silver",
      manage: "Your Silver",
    },
    /** Desktop-only chrome (Figma desktop-profile-* frames). */
    desktop: {
      searchPlaceholder: "Search people and posts",
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
    search: "Search",
    members: "Members",
    chat: "Chat",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings and Privacy",
    saved: "Saved",
    kinkcoins: "KinkCoins & Payment",
    subscription: "Silver Premium",
    kinkRings: "Kink Rings",
    logout: "Log Out",
  },
  /** The phone drawer's account menu (Philip's design): live entries, then Settings & Privacy. */
  accountMenu: {
    menuLabel: "Account menu",
    kinkopedia: "Kinkopedia",
    verification: "Verification",
    marketplace: "Marketplace",
    settings: "Settings & Privacy",
    groups: {
      account: "Account",
      privacy: "Privacy & Security",
      preference: "Preference",
      safety: "Safety",
      support: "Support",
    },
    accountSettings: "Account Settings",
    yourData: "Your Data",
    privacy: "Privacy",
    security: "Security",
    content: "Content & Experience",
    communitySafety: "Community & Safety",
    help: "Help & Support",
    about: "About Kinkord",
    soon: "Soon",
    viewProfile: "View profile",
  },
  notifications: {
    headline: "Notifications",
    constructionLead: "Alerts are",
    constructionAccent: "on the way",
    subcopy: "Follows, messages and mentions will land here soon.",
  },
} as const;

/** Countries the directory serves today; every other country is "Coming Soon". */
export const AVAILABLE_COUNTRIES = LAUNCH_COUNTRIES.map(({ code, name }) => ({
  code,
  name,
  flag: `/app/members/flag-${code.toLowerCase()}.svg`,
}));

/** Page size for the infinite-scrolling members list. */
export const MEMBERS_PAGE_SIZE = 20;
