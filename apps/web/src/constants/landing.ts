export const BRAND_NAME = "KINKORD";

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
  statement: "You must be 18 years of age or older to enter Kinkord.",
  intro:
    "Kinkord is an adult-oriented platform intended exclusively for adults. By entering, you confirm and represent that:",
  points: [
    { icon: "🔞", text: "You are at least 18 years old." },
    { icon: "⚖️", text: "You are legally permitted to access this platform." },
    { icon: "✅", text: "The age information you will provide is truthful and accurate." },
    {
      icon: "🚫",
      text: "You understand that minors are strictly prohibited from accessing or using Kinkord.",
    },
  ],
  warning:
    "⚠️ Providing false age information or attempting to bypass Kinkord's age restrictions may result in the immediate suspension or permanent termination of your access.",
  confirmLabel: "🛡️ I CONFIRM I AM 18 OR OLDER — ENTER",
  declineLabel: "🚪 I AM UNDER 18 — EXIT",
} as const;

export interface PolicyLink {
  label: string;
  href: string;
  icon: "privacy" | "terms" | "guidelines" | "cookie" | "safety" | "copyright";
}

export const POLICY_LINKS: readonly PolicyLink[] = [
  { label: "Privacy Policy", href: "#", icon: "privacy" },
  { label: "Terms of Service", href: "#", icon: "terms" },
  { label: "Community Guidelines", href: "#", icon: "guidelines" },
  { label: "Cookie Policy", href: "#", icon: "cookie" },
  { label: "Safety & Reporting", href: "#", icon: "safety" },
  { label: "Copyright Policy", href: "#", icon: "copyright" },
];


export const SOCIALS = [
  { name: "Instagram", href: "#", icon: "instagram" },
  { name: "X / Twitter", href: "#", icon: "twitter" },
  { name: "TikTok", href: "#", icon: "tiktok" },
  { name: "Telegram", href: "#", icon: "send" },
  { name: "WhatsApp", href: "#", icon: "message-circle" },
] as const;

export const COMPANY_NAME = "Temaxiro Limited";
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
