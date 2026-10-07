import type { CurrencyPM } from "@/domain/kinkcoins";

export const KINKCOINS_COPY = {
  title: "KinkCoins & Payment",
  heading: "Kink Currency",
  subtitle: "More ways to connect, support and enjoy the Kinkord experience.",
  benefits: [
    "Unlock premium features",
    "Support creators & communities",
    "Get more from your experience",
  ],
  comingSoon: "Coming soon",
  preview: "Wallet preview",
  notice:
    "Purchasing, gifting and earning are coming soon. Balances and prices shown here are previews; no payments are taken.",
  balance: "Your KinkCoins",
  balanceHint: "Earn, receive and spend KinkCoins within Kinkord when wallets launch.",
  buy: "Buy now",
  secure: "Secure Payments",
  secureHint: "Payment methods will be available when purchases launch.",
  earn: "Earn KinkCoins",
  earnHint: "Earning opportunities and rewards are coming soon.",
  gift: "Send gifts",
  giftHint: "Celebrate creators and members with in-app gifts. Coming soon.",
  back: "Back to home",
  menu: "Open menu",
  profileBalance: {
    amount: "0",
    label: "KinkCoins",
    status: "Preview",
    description: "Preview balance. Live coin balances will be available when wallets launch.",
  },
};

export const KINK_CURRENCIES: CurrencyPM[] = [
  {
    kind: "coin",
    name: "KinkCoin",
    plural: "KinkCoins",
    description: "The foundation of Kinkord.",
    unitPriceCents: 10,
    packs: [
      { quantity: 100, priceCents: 1000 },
      { quantity: 500, priceCents: 5000, badge: "POPULAR" },
      { quantity: 1000, priceCents: 10000 },
      { quantity: 2500, priceCents: 25000 },
    ],
  },
  {
    kind: "star",
    name: "KinkStar",
    plural: "KinkStars",
    description: "Show your support. Unlock exclusive content.",
    unitPriceCents: 100,
    packs: [
      { quantity: 10, priceCents: 1000 },
      { quantity: 50, priceCents: 5000, badge: "BEST VALUE" },
      { quantity: 100, priceCents: 10000 },
      { quantity: 250, priceCents: 25000 },
    ],
  },
  {
    kind: "crown",
    name: "KinkCrown",
    plural: "KinkCrowns",
    description: "The premium currency. For the ultimate experience.",
    unitPriceCents: 1000,
    packs: [
      { quantity: 1, priceCents: 1000 },
      { quantity: 3, priceCents: 3000 },
      { quantity: 5, priceCents: 5000, badge: "POPULAR" },
      { quantity: 10, priceCents: 10000 },
    ],
  },
];

export const KINKCOINS_OVERVIEW_COPY = {
  heading: "KinkCoins",
  description:
    "KinkCoins are Kinkord’s virtual currency. Use them to unlock premium experiences, support creators and more.",
  balance: "Your balance",
  preview: "Preview · Transactions coming soon",
  actions: [
    { kind: "buy", title: "Buy KinkCoins", description: "Get more coins, stars and crowns." },
    {
      kind: "earn",
      title: "Earn KinkCoins",
      description: "Complete tasks, join events and get rewarded.",
    },
    {
      kind: "history",
      title: "Transaction History",
      description: "View your coin, star and crown activity.",
    },
    {
      kind: "convert",
      title: "Convert / Use KinkCoins",
      description: "Turn your coins into stars, crowns or other benefits.",
    },
    {
      kind: "withdraw",
      title: "Withdraw / Redeem",
      description: "Cash out or redeem your balance.",
    },
  ],
} as const;
