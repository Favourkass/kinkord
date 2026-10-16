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
    { kind: "banks", title: "Bank Accounts", description: "Manage your withdrawal bank accounts." },
  ],
} as const;

export const KINKCOINS_HISTORY_COPY = {
  title: "Transaction History",
  menu: "Open menu",
  back: "Back to wallet",
  heading: "Your wallet activity",
  description: "Track your purchases, gifts, rewards, conversions and redemptions in one place.",
  preview: "Wallet preview",
  notice:
    "Transactions are coming soon. No purchases, gifts or rewards have been recorded in this preview.",
  total: "0 transactions",
  emptyTitle: "No transactions yet",
  emptyDescription:
    "When wallets launch, your KinkCoin, KinkStar and KinkCrown activity will appear here.",
  browse: "View KinkCoin bundles",
} as const;

export const KINKCOINS_WITHDRAW_COPY = {
  titles: {
    options: "Withdraw / Redeem",
    confirm: "Confirm Redemption",
    processing: "Withdrawal Processing",
  },
  menu: "Open menu",
  back: "Back to wallet",
  backOptions: "Back to redeem options",
  preview: "Design preview",
  previewNotice:
    "Sample balances, rates and bank details only. No withdrawal is submitted and your wallet balance will not change.",
  heading: "Turn Your KinkCoins Into Cash",
  description: "Redeem your KinkCoins for cash directly to your bank account. Fast. Safe. Secure.",
  options: "Redeem Options",
  optionsHint: "Each currency type can be redeemed separately. Minimum redemption amount is $100.",
  balance: "Your balance",
  value: "Estimated value",
  belowMinimum: "Below minimum ($100)",
  benefits: ["Secure Bank Transfer", "Fast Processing", "No Withdrawal Fee"],
  review: "Review your details before confirming.",
  equivalent: "Equivalent Value",
  minimum: "Minimum redemption",
  bankTitle: "Withdraw to",
  bankSelection: "Choose an account",
  manageBanks: "Manage bank accounts",
  bank: "Access Bank",
  account: "**** 4587 | Savings Account",
  saved: "Sample account",
  redemption: "Redemption Amount",
  fee: "Withdrawal Fee",
  receive: "You Will Receive",
  transfer: "Expected Transfer Time",
  time: "Within 24 hours",
  timeHint: "Preview estimate",
  important: "Important",
  warning:
    "Redemptions cannot be cancelled once submitted. Please make sure your details are correct before proceeding.",
  confirm: "Confirm Withdrawal (Preview)",
  submitted: "Withdrawal Submitted",
  submittedHint:
    "This is a preview of the processing screen. No real withdrawal request has been submitted.",
  amount: "Withdrawal Amount",
  method: "Bank Transfer",
  destination: "Your saved bank account (sample)",
  expected: "Expected within 24 hours",
  reference: "Transaction Reference",
  referenceValue: "KRD-PREVIEW-XXXXXX",
  processing:
    "Your withdrawal is currently being processed. You will receive your funds once the transfer is completed.",
  balanceUpdate: "Your balance will be updated after the transaction has been processed.",
  processingLabel: "Example processing message",
  home: "Back to home",
} as const;

export const KINKCOINS_REDEMPTION_SAMPLES = [
  { kind: "coin" as const, label: "Coins", balance: 2450, rateCents: 8 },
  { kind: "star" as const, label: "Stars", balance: 180, rateCents: 80 },
  { kind: "crown" as const, label: "Crowns", balance: 12, rateCents: 800 },
];

export const KINKCOINS_BANK_COPY = {
  title: "Bank Accounts",
  menu: "Open menu",
  back: "Back to wallet",
  heading: "Your withdrawal accounts",
  description: "Add more than one bank account and choose a default for withdrawals.",
  preview: "Wallet preview",
  notice:
    "Use test details only. Accounts are saved in this browser tab for this preview, not verified or usable for real withdrawals.",
  empty: "No bank accounts yet",
  emptyHint: "Add your first account below.",
  bank: "Bank name",
  holder: "Account holder name",
  number: "Account number",
  type: "Account type",
  savings: "Savings",
  current: "Current",
  save: "Save bank account",
  default: "Default",
  makeDefault: "Set as default",
  remove: "Remove",
  add: "Add bank account",
  saved: "Bank account saved.",
  removed: "Bank account removed.",
  updated: "Default bank account updated.",
  invalid: "Enter a bank name, account holder name and an account number with 6–20 digits.",
  storageError: "Could not save accounts in this browser. Please try again.",
} as const;
