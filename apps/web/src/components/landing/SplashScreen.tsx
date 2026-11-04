import Image from "next/image";
import Link from "next/link";
import { Download, Lock, LogIn, UserRoundPlus } from "lucide-react";
import AgeGateModal from "@/components/ui/AgeGateModal";
import brandStyles from "./LandingBrand.module.css";

export interface SplashLink {
  emoji?: string;
  label: string;
  href: string;
}

export interface SplashAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface SplashImage {
  src: string;
  alt: string;
}

export interface PolicyItem {
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

export interface AdultBadgeData {
  age: string;
  label: string;
  line1: string;
  line2: string;
}

export interface SplashScreenProps {
  logo: SplashImage;
  /** The animated wordmark, with a still for reduced motion. */
  wordmark: SplashImage & { width: number; height: number; still?: string };
  hero: SplashImage & { width: number; height: number };
  headerTagline: string;
  /** Who Kinkord is for, above the sign-up buttons. */
  audienceStatement: string;
  audienceLines: readonly { text: string; highlight: boolean }[];
  mobileContent?: {
    eyebrow: string;
    title: string;
    description: string;
    features: readonly {
      icon: "people" | "heart" | "shield" | "messages" | "crown";
      label: string;
    }[];
    footer: string;
  };
  platformOverview: { title: string; paragraphs: readonly string[] };
  mission: { title: string; paragraphs: readonly string[] };
  whyJoin: {
    title: string;
    subtitle: string;
    introduction: string;
    benefits: readonly { title: string; description: string }[];
    closing: string;
  };
  safeKink: {
    title: string;
    paragraphs: readonly string[];
    note: string;
    policy: string;
    statement: string;
    closing: string;
  };
  membership: {
    title: string;
    count: string;
    label: string;
    countries: string;
    description: string;
  };
  downloadCta: SplashAction;
  brand: string;
  tagline: string;
  signUp: SplashLink;
  signIn: SplashLink;
  joinAgeDisclaimer?: string;
  adultBadge?: AdultBadgeData;
  navLinks: SplashLink[];
  policyLinks?: PolicyItem[];
  socialLinks: readonly {
    name: string;
    href: string;
    icon: "facebook" | "twitter" | "instagram";
  }[];
  copyright: string;
  allRightsReserved?: string;
  ageDisclaimer?: { lead: string; rest: string };
  ageGate?: {
    title: string;
    badge: string;
    statement: string;
    intro?: string;
    points?: readonly { icon: string; text: string }[];
    warning?: string;
    confirmLabel: string;
    declineLabel: string;
  };
  showAgeGate?: boolean;
  onConfirmAge?: () => void;
  onDeclineAge?: () => void;
}

function ChevronIcon() {
  return (
    <span aria-hidden className="grid size-6 place-items-center">
      <svg width="9" height="16" viewBox="0 0 9 16" fill="none" overflow="visible">
        <path
          d="M1 1L8 8L1 15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function PolicyChevron() {
  return (
    <span
      aria-hidden
      className="grid size-4 sm:size-5 shrink-0 place-items-center text-[#ffcf0a] ml-1"
    >
      <svg width="7" height="12" viewBox="0 0 8 14" fill="none" overflow="visible">
        <path
          d="M1 1L7 7L1 13"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function StarDivider() {
  return (
    <div className="relative my-5 sm:my-6 flex w-full items-center justify-center">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ffcf0a]/60 to-transparent" />
      <div className="absolute grid size-5 place-items-center bg-black">
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          fill="none"
          className="text-[#ffcf0a]"
          aria-hidden
        >
          <path d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.3 6.9c-.3-.6-.6-.6-.9-.6h-.6c-.3 0-.6.1-.8.4-.6.6-.9 1.3-.9 2.1 0 1.3.9 2.6 1.1 2.8.1.2 1.9 3 4.6 4.1 2.2.9 2.7.7 3.2.6.5 0 1.6-.6 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.4l-1.8-.8c-.3-.1-.5-.2-.7.2l-.8 1c-.1.2-.3.2-.6.1-.8-.3-1.5-.7-2.1-1.3-.5-.5-1-1.1-1.4-1.7-.1-.3 0-.4.1-.6l.5-.6c.2-.2.2-.4.3-.6.1-.1 0-.4 0-.5l-.9-1.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FooterEmoji({ symbol, natural = false }: { symbol: string; natural?: boolean }) {
  if (symbol === "i" || symbol === "?") {
    return (
      <span aria-hidden="true" className={brandStyles.goldMedallion}>
        {symbol}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={
        natural ? brandStyles.footerEmoji : `${brandStyles.footerEmoji} ${brandStyles.goldEmoji}`
      }
    >
      {symbol}
    </span>
  );
}

function GoldTileIcon({ type }: { type: "marketplace" | "events" }) {
  const gradientId = `footer-gold-${type}`;
  return (
    <svg viewBox="0 0 28 28" className="size-[26px] shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.6" y2="1">
          <stop stopColor="#fff5ad" />
          <stop offset="0.35" stopColor="#ffd447" />
          <stop offset="1" stopColor="#b97806" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`} stroke="#eab638" strokeWidth="0.7" strokeLinejoin="round">
        {type === "marketplace" ? (
          <>
            <rect x="4" y="11" width="20" height="14" rx="2" />
            <path d="M4 4h20l2 8c0 3-4 4-6 1-2 3-5 3-6 0-2 3-5 3-6 0-2 3-6 2-6-1Z" />
            <path d="m9 4-1 9m6-9v9m5-9 1 9" fill="none" stroke="#a76b04" />
            <rect x="7" y="17" width="6" height="8" fill="#4d3303" />
            <rect x="17" y="17" width="4" height="4" fill="#4d3303" />
          </>
        ) : (
          <>
            <rect x="3" y="6" width="22" height="19" rx="3" />
            <rect x="7" y="2" width="3" height="8" rx="1.5" />
            <rect x="18" y="2" width="3" height="8" rx="1.5" />
            <path d="M4 12h20" stroke="#9a6100" />
            <path
              d="m14 13 1.7 3.4 3.8.6-2.7 2.6.6 3.8-3.4-1.8-3.4 1.8.6-3.8L8.5 17l3.8-.6Z"
              fill="#714400"
              stroke="#ffdf6a"
            />
          </>
        )}
      </g>
    </svg>
  );
}

function PolicyIcon({ type }: { type: PolicyItem["icon"] }) {
  if (type === "whatsapp") {
    return (
      <span className={brandStyles.whatsappMedallion}>
        <WhatsAppIcon className="size-full" />
      </span>
    );
  }
  if (type === "marketplace" || type === "events") return <GoldTileIcon type={type} />;
  const symbols: Record<
    Exclude<PolicyItem["icon"], "whatsapp" | "marketplace" | "events">,
    string
  > = {
    privacy: "🛡️",
    safety: "🛡️",
    terms: "📄",
    guidelines: "👥",
    cookie: "🍪",
    copyright: "©️",
    about: "i",
    contact: "✉️",
    invest: "🏛️",
    governance: "⚖️",
    advertising: "📣",
    help: "?",
  };
  return <FooterEmoji symbol={symbols[type]} />;
}

export function PolicyButtonsGrid({ links }: { links: PolicyItem[] }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:gap-3.5">
      {links.map((link) => {
        const isExternal = link.href.startsWith("http");
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
              <span className="shrink-0">
                <PolicyIcon type={link.icon} />
              </span>
              <span className="min-w-0 text-[11px] sm:text-[13px] lg:text-[14px] font-bold leading-[1.25] text-[#ffcf0a] break-words">
                {link.label}
              </span>
            </div>
            <PolicyChevron />
          </>
        );

        const className =
          "flex min-h-[52px] sm:min-h-[58px] py-2 items-center justify-between rounded-[14px] border border-[#ffcf0a] bg-black px-2.5 sm:px-4 text-[#ffcf0a] transition hover:border-[#ffcf0a] hover:bg-[#ffcf0a]/5 active:scale-[0.99]";

        if (isExternal) {
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
            </a>
          );
        }

        return (
          <Link key={link.label} href={link.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function SocialIcon({ icon }: { icon: "facebook" | "twitter" | "instagram" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 sm:size-7"
      aria-hidden="true"
    >
      {icon === "facebook" && (
        <path
          fill="currentColor"
          d="M15 3h3v4h-3c-.6 0-1 .4-1 1v3h4l-1 4h-3v7h-4v-7H7v-4h3V8a5 5 0 0 1 5-5Z"
        />
      )}
      {icon === "twitter" && (
        <path
          fill="currentColor"
          d="M22 5.9a8.2 8.2 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3 8.4 8.4 0 0 1-2.6 1 4.2 4.2 0 0 0-7.2 3.8A11.9 11.9 0 0 1 3 4.7a4.2 4.2 0 0 0 1.3 5.6 4.1 4.1 0 0 1-1.9-.5 4.2 4.2 0 0 0 3.4 4.2 4.2 4.2 0 0 1-1.9.1 4.2 4.2 0 0 0 3.9 2.9A8.4 8.4 0 0 1 2 18.7a11.8 11.8 0 0 0 18.2-10 8.4 8.4 0 0 0 1.8-2.8Z"
        />
      )}
      {icon === "instagram" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

function FooterNotice({
  copyright,
  allRightsReserved,
  socialLinks,
}: Pick<SplashScreenProps, "copyright" | "allRightsReserved" | "socialLinks">) {
  return (
    <footer className="mt-6 w-full max-w-[760px] rounded-[22px] bg-[#080808] px-4 py-6 text-center sm:px-6">
      <nav aria-label="Follow Kinkord" className="flex items-center justify-center gap-6 sm:gap-10">
        {socialLinks.map((social) => (
          <a
            key={social.icon}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${social.name} (opens in a new tab)`}
            className="grid size-12 place-items-center rounded-full bg-kink-gold-bright/5 text-kink-gold-bright transition hover:bg-kink-gold-bright/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kink-gold-bright sm:size-16"
          >
            <SocialIcon icon={social.icon} />
          </a>
        ))}
      </nav>
      <div className="my-6 h-px bg-kink-gold-bright/35" />
      <p className="text-[12px] sm:text-[14px] font-medium text-kink-gold-bright">{copyright}</p>
      {allRightsReserved && (
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] sm:text-[13px] font-medium text-kink-gold-bright">
          <Lock className="size-3.5 text-[#faab14]" aria-hidden />
          <span>{allRightsReserved}</span>
        </p>
      )}
    </footer>
  );
}

function DownloadPill({ cta, compact }: { cta: SplashAction; compact?: boolean }) {
  const isInactive = cta.label === "App Installed" || cta.label === "Installing...";
  const className = `relative inline-flex items-center justify-center gap-2 rounded-full border border-[#ffdd49] bg-gradient-to-b from-[#fff06b] via-[#ffcf0a] to-[#ffb800] font-extrabold text-black shadow-[inset_0_2px_3px_#fff9] transition hover:brightness-110 active:scale-95 cursor-pointer touch-manipulation select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kink-gold-bright disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${
    compact ? "min-h-9 px-3 text-xs sm:min-h-11 sm:px-4 sm:text-base" : "min-h-[52px] px-5 text-lg"
  }`;
  const content = (
    <>
      <Download aria-hidden="true" className="size-5 shrink-0 sm:size-6" strokeWidth={3} />
      <span aria-hidden="true" className="h-5 w-px bg-black/80 sm:h-6" />
      <span>{cta.label}</span>
    </>
  );

  if (cta.onClick) {
    return (
      <button
        type="button"
        onClick={cta.onClick}
        disabled={isInactive}
        aria-label={cta.label}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={cta.href ?? "#"} aria-label={cta.label} className={className}>
      {content}
    </Link>
  );
}

function SignUpButton({ cta }: { cta: SplashLink }) {
  return (
    <Link
      href={cta.href}
      className={`${brandStyles.signup} flex h-[48px] sm:h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#ffce45] to-[#f4aa05] text-[15px] sm:text-[18px] font-extrabold text-black`}
    >
      <UserRoundPlus aria-hidden className="size-6 shrink-0" strokeWidth={3} />
      {cta.label}
    </Link>
  );
}

function SignInButton({ cta }: { cta: SplashLink }) {
  return (
    <Link
      href={cta.href}
      className="flex h-[48px] sm:h-[56px] w-full items-center justify-center gap-2 rounded-[10px] border border-kink-amber text-[15px] sm:text-[18px] font-extrabold text-kink-gold-bright"
    >
      <LogIn aria-hidden className="size-6 shrink-0" strokeWidth={3} />
      {cta.label}
    </Link>
  );
}

function MembershipCount({
  title,
  count,
  label,
  countries,
  description,
}: SplashScreenProps["membership"]) {
  return (
    <section
      className="w-full rounded-2xl border border-kink-amber/55 bg-black/80 p-4 text-left sm:p-7"
      aria-label={title}
    >
      <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">{title}</h2>
      <p
        className="mt-3 flex items-center justify-center gap-2 whitespace-nowrap text-[clamp(13px,3.8vw,24px)] font-bold leading-tight text-kink-gold-bright sm:gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <span aria-hidden="true" className={`${brandStyles.emoji} shrink-0`}>
          🌍
        </span>
        <span>
          {count} {label}{" "}
          <span className="mx-1 font-normal" aria-hidden="true">
            |
          </span>{" "}
          {countries}
        </span>
      </p>
      <p className="mt-3 text-sm leading-[1.45] text-kink-mist sm:text-lg">{description}</p>
    </section>
  );
}

function WhyJoin({
  title,
  subtitle,
  introduction,
  benefits,
  closing,
}: SplashScreenProps["whyJoin"]) {
  return (
    <section className="w-full rounded-2xl border border-kink-amber/55 bg-black/80 p-5 text-left sm:p-7">
      <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">{title}</h2>
      <p className="mt-3 text-lg font-semibold text-kink-paper sm:text-xl">{subtitle}</p>
      <p className="mt-3 text-sm leading-[1.5] text-kink-paper sm:text-lg">{introduction}</p>
      <ol className="mt-6 list-decimal space-y-6 pl-5 marker:font-bold marker:text-kink-gold-bright">
        {benefits.map((benefit) => (
          <li key={benefit.title} className="pl-1">
            <h3 className="text-base font-bold text-kink-gold-bright sm:text-xl">
              {benefit.title}
            </h3>
            <p className="mt-2 text-sm leading-[1.5] text-kink-paper sm:text-lg">
              {benefit.description}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-kink-amber/40 pt-5 text-center text-base font-semibold text-kink-gold-bright sm:text-lg">
        {closing}
      </p>
    </section>
  );
}

function PlatformOverview({ title, paragraphs }: SplashScreenProps["platformOverview"]) {
  return (
    <section className="w-full space-y-4 rounded-2xl border border-kink-amber/55 bg-black/80 p-5 sm:p-7 text-left">
      <h2 className="text-left text-xl sm:text-2xl font-bold text-kink-gold-bright">{title}</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm sm:text-lg leading-[1.5] text-kink-paper">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

function SafeKink({
  title,
  paragraphs,
  note,
  policy,
  statement,
  closing,
}: SplashScreenProps["safeKink"]) {
  return (
    <section className="w-full space-y-4 rounded-2xl border border-kink-amber/55 bg-black/80 p-5 text-left text-sm leading-[1.5] text-kink-paper sm:p-7 sm:text-lg">
      <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">{title}</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p className="rounded-xl border-l-4 border-kink-gold-bright bg-kink-gold-bright/10 p-4">
        {note}
      </p>
      <p className="text-kink-gold-bright">{policy}</p>
      <p>{statement}</p>
      <p className="border-t border-kink-amber/40 pt-5 text-center text-kink-gold-bright">
        {closing}
      </p>
    </section>
  );
}

export default function SplashScreen({
  logo,
  hero,
  audienceStatement,
  audienceLines,
  platformOverview,
  mission,
  whyJoin,
  safeKink,
  membership,
  downloadCta,
  brand,
  signUp,
  signIn,
  navLinks,
  policyLinks,
  socialLinks,
  copyright,
  allRightsReserved,
  ageGate,
  showAgeGate,
  onConfirmAge,
  onDeclineAge,
}: SplashScreenProps) {
  return (
    <div className="min-h-dvh bg-black">
      {showAgeGate && ageGate && onConfirmAge && onDeclineAge && (
        <AgeGateModal
          open={showAgeGate}
          title={ageGate.title}
          badge={ageGate.badge}
          statement={ageGate.statement}
          intro={ageGate.intro}
          points={ageGate.points}
          warning={ageGate.warning}
          confirmLabel={ageGate.confirmLabel}
          declineLabel={ageGate.declineLabel}
          onConfirm={onConfirmAge}
          onDecline={onDeclineAge}
        />
      )}

      <div className="mx-auto w-full max-w-[1080px]">
        <header className="flex min-h-[76px] items-center justify-between gap-3 bg-black px-4 py-2 sm:px-8 sm:py-3">
          <h1 className="sr-only">{brand}</h1>
          <div className="size-14 shrink-0 sm:size-[76px]">
            <Image
              src={logo.src}
              alt={logo.alt}
              width={76}
              height={76}
              className="h-full w-full object-contain"
              preload
            />
          </div>
          <div className="origin-right scale-[0.8]">
            <DownloadPill cta={downloadCta} compact />
          </div>
        </header>

        <section className={brandStyles.maskHero} aria-label={audienceStatement}>
          <Image
            src={hero.src}
            alt={hero.alt}
            width={hero.width}
            height={hero.height}
            preload
            sizes="(max-width: 1080px) 100vw, 1080px"
            className={brandStyles.maskArtwork}
          />
          <p aria-label={audienceStatement} className={brandStyles.heroHeadline}>
            {audienceLines.map((line) => (
              <span
                key={line.text}
                aria-hidden="true"
                className={`block ${line.highlight ? "text-[#ffcf0a]" : "text-white"}`}
              >
                {line.text}
              </span>
            ))}
          </p>
        </section>

        <div
          className={`${brandStyles.community} flex flex-col items-center px-5 pb-8 pt-3 sm:px-8 sm:pt-5`}
        >
          <div className="grid w-full max-w-[760px] grid-cols-2 gap-2.5 sm:gap-4">
            <SignUpButton cta={signUp} />
            <SignInButton cta={signIn} />
          </div>
          <div className="mt-6 w-full max-w-[760px] space-y-6">
            <PlatformOverview {...platformOverview} />
            <PlatformOverview {...mission} />
            <MembershipCount {...membership} />
            <WhyJoin {...whyJoin} />
            <SafeKink {...safeKink} />
          </div>
          <nav
            aria-label="About Kinkord"
            className="mt-6 w-full max-w-[760px] rounded-[20px] border border-kink-amber/50 bg-kink-surface px-[22px]"
          >
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex h-[52px] items-center justify-between text-[15px] font-extrabold tracking-[0.3px] text-kink-gold-bright transition hover:bg-white/5 ${i > 0 ? "border-t border-kink-divider" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {link.emoji && <FooterEmoji symbol={link.emoji} natural={link.emoji === "📖"} />}
                  {link.label}
                </span>
                <span className="text-kink-gold-bright">
                  <ChevronIcon />
                </span>
              </Link>
            ))}
          </nav>
          {policyLinks && policyLinks.length > 0 && (
            <div className="mt-3 w-full max-w-[760px]">
              <StarDivider />
              <PolicyButtonsGrid links={policyLinks} />
            </div>
          )}
          <FooterNotice
            copyright={copyright}
            allRightsReserved={allRightsReserved}
            socialLinks={socialLinks}
          />
        </div>
      </div>
    </div>
  );
}
