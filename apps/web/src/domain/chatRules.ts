/**
 * The community rule shown before a member can use messaging.
 *
 * Copy lives here, not in the component, for two reasons: it is the kind of
 * text that will be reviewed and edited by someone who is not editing JSX, and
 * a test can assert the whole structure without rendering anything.
 */
export type ChatRuleSectionKind = "plain" | "gift" | "warning";

export interface ChatRuleSection {
  kind: ChatRuleSectionKind;
  /** Marker glyph; plain sections have none. */
  icon?: string;
  title: string;
  /** Sentence before a bullet list; only used on plain sections. */
  lead?: string;
  /** Bullet items; only used on plain sections. */
  bullets?: string[];
  /** Paragraphs; only used on gift and warning sections. */
  paragraphs?: string[];
}

export const CHAT_RULES = {
  badge: "🚫",
  title: "Kinkord Community Rule",
  intro:
    "Kinkord is a lifestyle and social community — not a marketplace, financial platform, or pay-for-play app. Before messaging, please understand:",
  sections: [
    {
      kind: "plain",
      title: "Financial solicitation is strictly prohibited.",
      lead: "You may not use Kinkord to:",
      bullets: [
        "Ask anyone for money or financial assistance.",
        "Request cash transfers, bank transfers, crypto, or other payments.",
        "Post or send payment links, payment handles, bank details, or wallet addresses for the purpose of receiving money.",
        "Ask for money, gifts, or payment in exchange for attention, affection, relationships, sexual activity, or kink interactions.",
        "Offer or arrange sexual services, paid sexual interactions, or pay-for-play arrangements.",
        "Use DMs, posts, comments, profiles, or any other part of Kinkord to solicit money.",
      ],
    },
    {
      kind: "gift",
      icon: "🎁",
      title: "Kinkord Gifts",
      paragraphs: [
        "Kinkord Gifts are intended as virtual expressions of appreciation and community interaction.",
        "Monetized users, creators, or Findommes who are verified by Kinkord may have access to gifting and monetization features when officially introduced by Kinkord.",
        "Until those features are officially available, do not ask other users for money, gifts, KinkCoins, or financial support.",
      ],
    },
    {
      kind: "warning",
      icon: "⚠️",
      title: "Strict Enforcement",
      paragraphs: [
        "Financial solicitation and pay-for-play activity are not permitted anywhere on Kinkord, including private messages.",
        "Violations may result in immediate permanent removal from Kinkord, without a warning.",
      ],
    },
  ] satisfies ChatRuleSection[],
  report:
    "If someone asks you for money, payment, or paid sexual/kink activity, do not send it. Report the account to Kinkord.",
  closing: "By continuing to message, you acknowledge and agree to follow this rule.",
  acknowledgeLabel: "I Understand",
  neverLabel: "Never show this again",
} as const;
