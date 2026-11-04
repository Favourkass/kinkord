export const BRAND_NAME = "Kinkord";

/** The animated wordmark (cropped to what shows), and a still of it for reduced motion. */
export const HEADER_WORDMARK = {
  src: "/brand/kinkord-header.webp",
  still: "/brand/kinkord-header-still.webp",
  alt: BRAND_NAME,
  width: 540,
  height: 171,
} as const;

/** Static landing wordmark matching the community artwork. Other headers keep their animation. */
export const LANDING_WORDMARK = {
  src: "/brand/kinkord-mask-wordmark.webp",
  alt: BRAND_NAME,
  width: 720,
  height: 232,
} as const;

export const LANDING_HEADER_TAGLINE = "THE WORLD’S KINK COMMUNITY";

export const LANDING_AUDIENCE_STATEMENT =
  "The Global Social Network for Kinksters, Fetishists & BDSM Enthusiasts.";

export const LANDING_AUDIENCE_LINES = [
  { text: "The Global Social Network", highlight: true },
  { text: "for Kinksters, Fetishists & BDSM Enthusiasts.", highlight: true },
] as const;

export const BRAND_TAGLINE =
  "Where kinksters connect, explore their interests, build meaningful relationships, and find a community where they truly belong.";

export const COPYRIGHT_LINE = "© 2026 Kinkord Limited. A Temaxiro Company";

export const AGE_DISCLAIMER_LEAD = "18+ Only.";
export const AGE_DISCLAIMER_TEXT = "You must be 18 or older to access Kinkord.";
export const AGE_DISCLAIMER_FOOTER =
  "18+ Only · You must be 18 or older to access Kinkord · Consensual adult community.";

export const JOIN_AGE_DISCLAIMER = "You must be 18 years or older to join.";
export const ALL_RIGHTS_RESERVED = "All rights reserved.";

export const ADULT_BADGE = {
  age: "18+",
  label: "ONLY",
  line1: "Kinkord is an adult Community.",
  line2: "You must be 18 years or older to join.",
} as const;

export const AGE_GATE_MODAL = {
  badge: "🔞 18+ ADULT COMMUNITY",
  title: "AGE VERIFICATION",
  statement: "You must be 18 or older to use Kinkord.",
  intro: "Kinkord is for adults only. By entering, you confirm that:",
  points: [
    { icon: "🔞", text: "You are 18 or older." },
    { icon: "⚖️", text: "You are legally allowed to use Kinkord." },
    { icon: "✅", text: "Your age details are true and correct." },
    {
      icon: "🚫",
      text: "You understand that anyone under 18 is not allowed on Kinkord.",
    },
  ],
  warning:
    "Providing a false age or bypassing this check may lead to your account being suspended or permanently banned.",
  confirmLabel: "I AM 18 OR OLDER — ENTER",
  declineLabel: "I AM UNDER 18 — EXIT",
} as const;

import { Routes } from "./Routes";

export const WHATSAPP_COMMUNITY_URL = "https://wa.me/2349127883266";

export interface PolicyLink {
  label: string;
  href: string;
  icon:
    | "privacy"
    | "terms"
    | "guidelines"
    | "cookie"
    | "safety"
    | "copyright"
    | "about"
    | "contact"
    | "invest"
    | "whatsapp"
    | "governance"
    | "advertising"
    | "marketplace"
    | "events"
    | "help";
}

export const POLICY_LINKS: readonly PolicyLink[] = [
  { label: "Trust & Safety", href: "#", icon: "privacy" },
  { label: "Governance & Transparency", href: "#", icon: "governance" },
  { label: "Legal & Policies", href: "#", icon: "terms" },
  { label: "Investors Portal", href: Routes.invest, icon: "invest" },
  { label: "Join Our Team", href: Routes.contact, icon: "guidelines" },
  { label: "Advertising", href: Routes.contact, icon: "advertising" },
  { label: "Marketplace", href: Routes.marketplace, icon: "marketplace" },
  { label: "Events", href: Routes.events, icon: "events" },
  { label: "Kinkord on WhatsApp", href: WHATSAPP_COMMUNITY_URL, icon: "whatsapp" },
  { label: "Help", href: Routes.contact, icon: "help" },
];

/** `href: null` = channel not launched yet; the footer shows it dimmed and unlinked. */
export const SOCIALS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/share/1Los7dVc57/",
    icon: "facebook",
  },
  { name: "X / Twitter", href: "https://x.com/kinkordofficial", icon: "twitter" },
  {
    name: "Instagram",
    href: "https://www.instagram.com/kinkordlimited/",
    icon: "instagram",
  },
  { name: "TikTok", href: null, icon: "tiktok" },
  { name: "Telegram", href: null, icon: "send" },
  { name: "WhatsApp", href: null, icon: "message-circle" },
] as const;

export const COMPANY_NAME = "Kinkord Limited";
export const COMPANY_ADDRESS = "30 Major Bowen Road, Sapele, Delta State, Nigeria";

export const FOOTER_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Consent Policy", href: "#" },
  { label: "Terms & Conditions", href: "#" },
] as const;

export const LECTURE_CATEGORIES = [
  "Consent & Communication",
  "BDSM Fundamentals",
  "Relationship Dynamics",
  "Safety Practices",
  "Community Etiquette",
  "Lifestyle Exploration",
  "Workshops & Discussions",
  "General",
] as const;

export const MOBILE_LANDING_CONTENT = {
  eyebrow: "MORE THAN A PLATFORM",
  title: "It's a Community.",
  description:
    "Connect with like-minded kinksters, explore your desires, and be part of a safe, respectful and exciting space.",
  features: [
    { icon: "people", label: "Meet like-minded kinksters" },
    { icon: "heart", label: "Explore your interests" },
    { icon: "shield", label: "Privacy & safety first" },
    { icon: "messages", label: "Real connections" },
    { icon: "crown", label: "Be your authentic self" },
  ],
  footer: "DIFFERENT KINKSTERS · SAME DESIRES",
} as const;

export const LANDING_PLATFORM_OVERVIEW = {
  title: "What is Kinkord?",
  paragraphs: [
    "Kinkord is a global, adults-only (18+) digital ecosystem dedicated to kink, fetishism, BDSM, and alternative lifestyles. More than a social networking or dating platform, Kinkord brings education, community, entertainment, content creation, events, and lifestyle experiences together in one integrated space, empowering adults worldwide to discover, learn, connect, create, and explore their interests.",
    "At the heart of Kinkord is a commitment to kink education, meaningful connections, and community development. Through Kinkopedia, social communities, multimedia content, creator opportunities, events, and a dedicated marketplace, Kinkord provides a comprehensive environment for beginners, experienced practitioners, educators, and enthusiasts alike.",
    "Kinkord is fundamentally a lifestyle-driven ecosystem, with approximately 99% of its focus dedicated to education, social networking, community building, entertainment, and personal exploration. The remaining 1% accommodates regulated commercial interactions involving verified service providers, subject to Kinkord's policies and applicable laws.",
    "Built on the principles of consent, privacy, safety, inclusivity, and mutual respect, Kinkord promotes responsible exploration within clearly defined personal boundaries and applicable laws. With a strong commitment to user verification, community protection, and continuous innovation, Kinkord aims to transform how adults worldwide understand, experience, and engage with kink while fostering a trusted global community where everyone with safe, legal, and consensual interests can belong without judgment.",
  ],
} as const;

export const LANDING_MISSION = {
  title: "Our Mission",
  paragraphs: [
    "To build the world's largest, most comprehensive, and most trusted global kink ecosystem, bringing education, innovation, social networking, dating and matchmaking, entertainment, content creation, commerce, and community development together on one integrated platform.",
    "Our mission is to empower adults worldwide to discover, learn, explore, create, connect, and participate in the diverse world of kink, fetishism, and BDSM while promoting knowledge, creativity, self-expression, meaningful relationships, and responsible exploration.",
    "We are committed to advancing kink education, supporting creators, fostering inclusive communities, and transforming how the world understands and experiences kink through technology and innovation, with consent, privacy, safety, verification, mutual respect, and compliance with applicable laws at the foundation of everything we do.",
  ],
} as const;

export const LANDING_WHY_JOIN = {
  title: "Why Join Kinkord",
  subtitle: "More Than a Community. A Lifestyle.",
  introduction:
    "Discover a world where kinksters can learn, connect, express themselves, and explore their interests in a welcoming community built on privacy, respect, and consent.",
  benefits: [
    {
      title: "📚 Explore & Learn with Kinkopedia",
      description:
        "Discover Kinkopedia, our ambitious project to build the world's largest kink encyclopedia. From articles and pictures to videos, PDFs, podcasts, and educational audio, we're bringing kink knowledge together in one place to educate kinksters around the world.",
    },
    {
      title: "🔐 Your Privacy, Your Choice",
      description:
        "We understand that privacy means different things to different people. That's why Kinkord offers extensive privacy features, giving you greater control over your identity, visibility, interactions, and personal information. Whether you prefer to be open or discreet, your privacy matters.",
    },
    {
      title: "🛡️ Verification You Can Trust",
      description:
        "Trust is essential in our community. Kinkord takes verification seriously, using a rigorous, multi-layered process that requires detailed identity and location checks. Our goal is to build a community where authenticity, accountability, and safety come first.",
    },
    {
      title: "🎬 Built for Content Creators",
      description:
        "Your creativity deserves an audience! Kinkord gives creators a place to share original content, educate, entertain, grow their following, and engage with people who appreciate their work.",
    },
    {
      title: "❤️ Lifestyle First, Not Pay-for-Play",
      description:
        "Kinkord is built around genuine kink lifestyles, not transactional encounters. We prioritize authentic connections, friendships, relationships, education, and shared experiences over pay-for-play activities.",
    },
    {
      title: "💰 Turn Your Passion into Earnings",
      description:
        "Your knowledge, creativity, and contributions can be rewarding. Kinkord provides monetization opportunities for eligible members, allowing them to earn through supported features while contributing to the community.",
    },
    {
      title: "🎭 Events with Verified Organizers",
      description:
        "Discover kink events, meetups, workshops, and experiences hosted by verified organizers. By requiring event hosts to undergo verification, we promote greater accountability and help members make more informed decisions about attending.",
    },
    {
      title: "📍 Find Kinksters Near You",
      description:
        "Your community might be closer than you think! Kinkord makes it easy to discover fellow kinksters by country, state, or region. Whether you're looking for local friends, meaningful connections, or people who share your interests, finding your kind of people starts here.",
    },
  ],
  closing: "Kinkord — The World's Kink Community. 🌍🖤",
} as const;

export const LANDING_SAFE_KINK = {
  title: "🖤 A Place for Every Safe, Legal Kink",
  paragraphs: [
    "At Kinkord, we believe every safe, legal, and consensual kink deserves a place.",
    "No matter how unusual, unconventional, or misunderstood your kink or sexual interest may be, as long as it involves consenting adults, respects personal boundaries, causes no non-consensual harm, and does not violate the law, it has a place in our community.",
  ],
  note: "Note: We have zero tolerance for sexual exploitation, abuse, or any sexual activity involving minors, animals, crime and lack of consent",
  policy: "In Kinkord our policy is - No kink-shaming. No judgment. No discrimination.",
  statement:
    "We celebrate the diversity of human sexuality while putting consent, safety, respect, and legality first.",
  closing: "🖤 Every Safe Kink Deserves a Community. Welcome to Kinkord.",
} as const;

export const LANDING_MEMBERS = {
  title: "Kinkord in Numbers",
  label: "members",
  countriesLabel: "countries",
  description:
    "A global community of kinksters connecting through meaningful conversations, friendships, and shared interests.",
  unavailable: "—",
} as const;
