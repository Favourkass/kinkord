import AnimatedWordmark from "@/components/app/AnimatedWordmark";
import Image from "next/image";
import Link from "next/link";
import {
  Cookie,
  Copyright,
  FileText,
  Info,
  Landmark,
  Lock,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";
import AgeGateModal from "@/components/ui/AgeGateModal";
import brandStyles from "./LandingBrand.module.css";

export interface SplashLink {
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
    | "whatsapp";
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
  membership: { count: string; label: string; countries: string; description: string };
  downloadCta: SplashAction;
  brand: string;
  tagline: string;
  signUp: SplashLink;
  signIn: SplashLink;
  joinAgeDisclaimer?: string;
  adultBadge?: AdultBadgeData;
  navLinks: SplashLink[];
  policyLinks?: PolicyItem[];
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

function UserIcon() {
  return (
    <span aria-hidden className="grid size-[33px] place-items-center">
      <svg width="24" height="27" viewBox="0 0 24 26.75" fill="none" overflow="visible">
        <path
          d="M23 25.75C23 21.953 18.0751 18.875 12 18.875C5.92487 18.875 1 21.953 1 25.75M12 14.75C8.20304 14.75 5.125 11.672 5.125 7.875C5.125 4.07804 8.20304 1 12 1C15.797 1 18.875 4.07804 18.875 7.875C18.875 11.672 15.797 14.75 12 14.75Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function SignInIcon() {
  return (
    <span aria-hidden className="grid size-[33px] place-items-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" overflow="visible">
        <path
          d="M12 7.875L16.125 12L12 16.125M16.125 12H1M7.875 5.46681V5.40027C7.875 3.86012 7.875 3.08948 8.17473 2.50122C8.43838 1.98378 8.85877 1.56338 9.37622 1.29973C9.96448 1 10.7351 1 12.2753 1H18.6003C20.1404 1 20.9094 1 21.4977 1.29973C22.0151 1.56338 22.4369 1.98378 22.7006 2.50122C23 3.0889 23 3.85862 23 5.39575V18.6049C23 20.1421 23 20.9107 22.7006 21.4983C22.4369 22.0158 22.0151 22.4369 21.4977 22.7006C20.91 23 20.1414 23 18.6042 23H12.2708C10.7336 23 9.9639 23 9.37622 22.7006C8.85877 22.4369 8.43838 22.0154 8.17473 21.4979C7.875 20.9097 7.875 20.1401 7.875 18.6V18.5313"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
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
      className="grid size-4 sm:size-5 shrink-0 place-items-center text-[#faab14] ml-1"
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
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#faab14]/60 to-transparent" />
      <div className="absolute grid size-5 place-items-center bg-black">
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          fill="none"
          className="text-[#faab14]"
          aria-hidden
        >
          <path d="M7 0L8.5 5.5L14 7L8.5 8.5L7 14L5.5 8.5L0 7L5.5 5.5L7 0Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

function ContactIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="23" y1="8" y2="8" />
      <line x1="19" x2="23" y1="12" y2="12" />
      <line x1="19" x2="23" y1="16" y2="16" />
    </svg>
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

function PolicyIcon({ type }: { type: PolicyItem["icon"] }) {
  switch (type) {
    case "privacy":
      return <Shield className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "terms":
      return <FileText className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "guidelines":
      return <Users className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "cookie":
      return <Cookie className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "safety":
      return <ShieldAlert className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "copyright":
      return <Copyright className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "about":
      return <Info className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "contact":
      return <ContactIcon className="size-[18px] sm:size-[22px] text-[#faab14]" />;
    case "invest":
      return <Landmark className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "whatsapp":
      return <WhatsAppIcon className="size-[18px] sm:size-[22px] text-[#faab14]" />;
    default:
      return <Shield className="size-[18px] sm:size-[22px] text-[#faab14]" aria-hidden />;
  }
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
              <span className="min-w-0 text-[11px] sm:text-[13px] lg:text-[14px] font-bold leading-[1.25] text-kink-gold-bright break-words">
                {link.label}
              </span>
            </div>
            <PolicyChevron />
          </>
        );

        const className =
          "flex min-h-[52px] sm:min-h-[58px] py-2 items-center justify-between rounded-[14px] border border-[#faab14]/40 bg-[#0c0c0b] px-2.5 sm:px-4 text-kink-gold-bright transition hover:border-[#faab14] hover:bg-[#181815] active:scale-[0.99]";

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

function FooterNotice({
  copyright,
  allRightsReserved,
}: {
  copyright: string;
  allRightsReserved?: string;
}) {
  return (
    <div className="py-6 text-center">
      <p className="text-[12px] sm:text-[14px] font-medium text-kink-gold-bright">{copyright}</p>
      {allRightsReserved && (
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] sm:text-[13px] font-medium text-kink-gold-bright">
          <Lock className="size-3.5 text-[#faab14]" aria-hidden />
          <span>{allRightsReserved}</span>
        </p>
      )}
    </div>
  );
}

function DownloadPill({ cta, compact }: { cta: SplashAction; compact?: boolean }) {
  const isInactive = cta.label === "App Installed" || cta.label === "Installing...";
  const className = `relative grid place-items-center rounded-[24px] bg-kink-gold-deep font-extrabold tracking-[0.3px] text-black transition hover:brightness-110 active:scale-95 cursor-pointer touch-manipulation select-none before:absolute before:-inset-2.5 before:content-[''] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${
    compact ? "min-h-11 px-3.5 text-[11px] sm:px-5 sm:text-sm" : "h-[60px] w-[254px] text-[24px]"
  }`;

  if (cta.onClick) {
    return (
      <button
        type="button"
        onClick={cta.onClick}
        disabled={isInactive}
        aria-label={cta.label}
        className={className}
      >
        {cta.label}
      </button>
    );
  }

  return (
    <Link href={cta.href ?? "#"} aria-label={cta.label} className={className}>
      {cta.label}
    </Link>
  );
}

function SignUpButton({ cta }: { cta: SplashLink }) {
  return (
    <Link
      href={cta.href}
      className={`${brandStyles.signup} flex h-[48px] sm:h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#ffce45] to-[#f4aa05] text-[15px] sm:text-[18px] font-bold text-black`}
    >
      <UserIcon />
      {cta.label}
    </Link>
  );
}

function SignInButton({ cta }: { cta: SplashLink }) {
  return (
    <Link
      href={cta.href}
      className="flex h-[48px] sm:h-[56px] w-full items-center justify-center gap-2 rounded-[10px] border border-kink-amber text-[15px] sm:text-[18px] font-bold text-kink-gold-bright uppercase"
    >
      <SignInIcon />
      {cta.label}
    </Link>
  );
}

function MembershipCount({
  count,
  label,
  countries,
  description,
}: SplashScreenProps["membership"]) {
  return (
    <section className="w-full pb-5 pt-6 text-center" aria-label={label}>
      <h2
        className="flex items-center justify-center gap-3 whitespace-nowrap text-[clamp(14px,4vw,24px)] font-bold leading-tight text-kink-gold-bright"
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
      </h2>
      <p className="mx-auto mt-3 max-w-[580px] text-sm leading-[1.45] text-kink-mist sm:text-lg">
        {description}
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

export default function SplashScreen({
  wordmark,
  hero,
  headerTagline,
  platformOverview,
  membership,
  downloadCta,
  brand,
  signUp,
  signIn,
  navLinks,
  policyLinks,
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
          <div className="w-[44%] max-w-[230px] shrink-0">
            <AnimatedWordmark image={wordmark} />
            <p className="-mt-0.5 whitespace-nowrap text-center text-[8px] font-bold tracking-[0.2px] text-kink-gold-bright sm:text-[11px]">
              {headerTagline}
            </p>
          </div>
          <DownloadPill cta={downloadCta} compact />
        </header>

        <div className="relative">
          {/* Display only the upper 625px of the 1080px-wide artwork. The baked-in
              wordmark starts below this crop; never use object-cover here. */}
          <div className="relative aspect-[1080/625] overflow-hidden">
            <Image
              src={hero.src}
              alt={hero.alt}
              width={hero.width}
              height={hero.height}
              preload
              sizes="(max-width: 1080px) 100vw, 1080px"
              className="block h-auto w-full max-w-none"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-black via-black/35 to-transparent"
            />
          </div>
          <span role="img" aria-label="Adults only, 18 plus" className={brandStyles.ageSeal}>
            18+
          </span>
        </div>

        <div
          className={`${brandStyles.community} flex flex-col items-center px-5 pb-8 pt-3 sm:px-8 sm:pt-5`}
        >
          <div className="grid w-full max-w-[760px] grid-cols-2 gap-2.5 sm:gap-4">
            <SignUpButton cta={signUp} />
            <SignInButton cta={signIn} />
          </div>
          <div className="w-full max-w-[760px]">
            <MembershipCount {...membership} />
            <PlatformOverview {...platformOverview} />
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
                {link.label}
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
          <FooterNotice copyright={copyright} allRightsReserved={allRightsReserved} />
        </div>
      </div>
    </div>
  );
}
