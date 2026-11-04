/** Copy for the country check (CTO, 2026-11-02): sign-up, the member screen and Moderation → Location. */

export const LOCATION_CHECK_COPY = {
  heading: { plain: "Confirm", highlight: "Where You Are" },
  /** Shown before the browser asks, so nobody meets the permission prompt cold. */
  intro: [
    "Kinkord follows the rules of the country you're in, and members trust where others say they are. So we check your country when you join, when you sign in, and now and then after.",
    "Your browser will ask to share your location. Kinkord turns it into a country on its own servers and keeps only the country, never your exact position. We also look at the country of your internet connection.",
  ],
  confirming: (country: string) => `You chose ${country}.`,
  privacyLink: "How the location check works",
  share: "Share my location",
  working: "Checking where you are…",
  skip: "Not now",
  retry: "Try again",
  changeCountry: "Change country",
  problems: {
    /** The CTO's wording, used as given. */
    mismatch:
      "⚠️ Your selected country does not match your current location. Please select the country where you are physically located and try again.",
    vpnHint: "If you're using a VPN or proxy, turn it off and try again.",
    allowLocation:
      "Kinkord needs your location to confirm your country. Allow location for this site in your browser or phone settings, then try again.",
    noLocation: "We couldn't get your location. Turn on location services and try again.",
    noConnection: "We couldn't check your connection. Check your internet and try again.",
    refused:
      "We couldn't confirm your location. Turn off any VPN, proxy or app that changes your location, then try again.",
    paused: "Too many attempts. Please try again in 24 hours.",
    busy: "Too many checks from your connection right now. Try again in a few minutes.",
    shareNeeded: "Share your location to continue.",
    expired: "That check has expired. Confirm where you are again.",
  },
} as const;

/** The screen members are held at when a check is due (/location-check). */
export const MEMBER_LOCATION_COPY = {
  chooseTitle: "Where are you now?",
  chooseBody:
    "Choose the country you're in and your state. We'll check your location, then update your profile.",
  countryLabel: "Country",
  countryPlaceholder: "Choose your country",
  countrySearch: "Search countries",
  noCountries: "No countries found",
  stateRequired: "Choose your state first.",
  loading: "Loading…",
  loadError: "We couldn't load your profile.",
  retry: "Try again",
  saveError: "Your country couldn't be saved. Try again.",
} as const;

export const LOCATION_ADMIN_COPY = {
  intro:
    "Every country check, with what the GPS, the connection and the device said. Coordinates and IP addresses are never stored.",
  modes: {
    off: { label: "Off", body: "No checks run." },
    watch: {
      label: "Watch",
      body: "Checks run and are recorded, but nobody is stopped. Members can choose Not now.",
    },
    enforce: {
      label: "Enforce",
      body: "The decisions apply: members must pass to join, sign in and change country.",
    },
  },
  modeTitle: "Mode",
  switchTo: (label: string) => `Switch to ${label}`,
  switchTitle: (label: string) => `Switch the country check to ${label}?`,
  switchConfirm: "It applies to every member within 30 seconds.",
  founderOnly: "Only the founders can switch the country check.",
  confirm: "Switch",
  cancel: "Cancel",
  window: (days: number) => `Last ${days} days`,
  stats: {
    checks: "Checks",
    people: "People checked",
    stopped: "Would be stopped",
    stoppedEnforced: "Stopped",
    stoppedNote: "People whose latest check wouldn't let them through.",
  },
  decisionsTitle: "Decisions",
  reasonsTitle: "Most common reasons",
  dataTitle: "IP data",
  dataLines: {
    country: (date: string) => `Country data built ${date}`,
    network: (date: string) => `Network data built ${date}`,
    tor: (count: number, when: string) => `${count} Tor exits, updated ${when}`,
    missing: "Not loaded: every check will ask members to retry.",
    networkMissing: "Network data not loaded: VPN detection is off.",
    torMissing: "Tor list not loaded yet.",
  },
  recentTitle: "Recent checks",
  allDecisions: "All decisions",
  chose: "Chose",
  gps: "GPS",
  connection: "Connection",
  decision: "Decision",
  when: "When",
  notEnforced: "watching",
  empty: "No checks yet.",
  loadMore: "Load more",
  loading: "Loading…",
  loadError: "Couldn't load the checks. Try again.",
  decisions: {
    approved: "Approved",
    travel: "Travelling",
    mismatch: "Mismatch",
    retry: "Retry",
    refused: "Refused",
    paused: "Paused",
    skipped: "Skipped",
  },
  purposes: { signup: "Joining", recheck: "Recheck", change: "Changing country" },
  anonymizers: { tor: "Tor", hosting: "VPN / hosting" },
  /** What each recorded reason means, in a moderator's words. */
  reasons: {
    gps_match: "GPS matched",
    ip_match: "Connection matched",
    abroad: "Away, recent check at home",
    elsewhere: "GPS and connection elsewhere",
    vpn: "Matched only through a VPN",
    vpn_location: "GPS only estimated, on a VPN",
    gps_contradicted: "Connection and clock contradict the GPS",
    device_elsewhere: "GPS and clock agree on elsewhere",
    gps_denied: "Location permission refused",
    gps_unavailable: "No location",
    gps_timeout: "Location timed out",
    gps_unsupported: "No location in this browser",
    gps_no_country: "Location in no country",
    ip_unavailable: "Connection unknown",
    automation: "Browser automation",
    location_overridden: "Location answered by a script",
    gps_out_of_range: "Impossible coordinates",
    gps_perfect_accuracy: "Impossible accuracy",
    gps_null_island: "Coordinates 0, 0",
    gps_not_a_number: "Broken coordinates",
    impossible_travel: "Impossible travel",
    too_many_failures: "Too many failed tries",
    too_many_countries: "Too many countries tried",
    skipped: "Chose Not now",
    hosting: "VPN or hosting network",
    tor: "Tor",
    ip_elsewhere: "Connection in another country",
    gps_elsewhere: "GPS in another country",
    gps_coarse: "GPS only estimated",
    timezone_elsewhere: "Clock in another country's zone",
    emulator: "Software graphics (emulator?)",
  } as Record<string, string>,
} as const;

/** The public notice linked from the check: /privacy/location. */
export const LOCATION_PRIVACY_COPY = {
  brand: "KINKORD",
  contactLabel: "Contact us",
  eyebrow: "Trust & safety / Location check",
  headline: { lead: "Your country,", accent: "not your address." },
  lead: "Why Kinkord checks the country you're in, what it looks at, and what it keeps.",
  effectiveDate: "Effective date: 2 November 2026",
  choice: {
    title: "Why we ask",
    body: "Kinkord follows the rules of the country you're in, and members need to trust where others say they are. So Kinkord checks your country when you join, when you sign in and from time to time. Sharing your location is needed to pass the check.",
  },
  onThisPage: "On this page",
  sections: [
    {
      id: "what",
      title: "What we look at",
      paragraphs: [
        "Your device's location, which your browser asks you to share each time.",
        "The country of your internet connection, worked out from its address, and whether the connection comes through a VPN, proxy, Tor or a hosting service.",
        "A few signals from your browser: its time zone, whether automation is driving it, whether another program is answering its location, and the name of its graphics renderer.",
      ],
    },
    {
      id: "keep",
      title: "What we keep",
      paragraphs: [
        "Your location is turned into a country on Kinkord's own servers; no map or location company sees it. Your exact position is never stored. We keep the country, how accurate the reading was and, to spot impossible travel, a rough area of about 11 km, replaced at your next check.",
        "We keep your connection's country and network name, not its address. A scrambled form of the address is kept only to limit repeated attempts.",
        "Each check is kept for 90 days, then deleted.",
      ],
    },
    {
      id: "decide",
      title: "How the check decides",
      paragraphs: [
        "If your location or your connection is in the country you chose, the check passes. If neither is, you're asked to choose the country you're in.",
        "A VPN never fails a check on its own, but a connection through one doesn't count as being in a country.",
        "Clear signs of faking, such as a program changing your location, fail that attempt. You can try again; after several failed attempts in a day, checks pause for 24 hours.",
        "Members away from home keep their home country, and its rules, for 30 days after a check there.",
      ],
    },
    {
      id: "who",
      title: "Who sees it",
      paragraphs: [
        "Only Kinkord's admins, to keep members safe and to look into fraud. Other members never see your checks.",
        "Kinkord Limited, Sapele, Delta State, Nigeria, is the data controller. Send questions to support@kinkord.com or through the Contact page.",
      ],
    },
  ],
  provider: {
    id: "ip-data",
    title: "IP data",
    body: "Connection countries come from DB-IP's IP to Country Lite and IP to ASN Lite data, used under the Creative Commons Attribution 4.0 licence. Kinkord downloads the data; your address is never sent to DB-IP.",
    linkLabel: "IP Geolocation by DB-IP ↗",
    href: "https://db-ip.com",
  },
  help: {
    title: "Think a check got it wrong?",
    body: "Get in touch through Kinkord support and we'll look into it.",
    cta: "Contact Kinkord",
  },
  footer: "© Kinkord Limited · Location check notice",
} as const;
