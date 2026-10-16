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
  wordmark: SplashImage & { width: number; height: number };
  hero: SplashImage;
  mobileHero?: SplashImage & { width: number; height: number };
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

function AdultAgeBadge({ badge, className = "" }: { badge: AdultBadgeData; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-3 sm:gap-3.5 rounded-[22px] border-[1.5px] border-[#faab14] bg-black/50 px-5 py-2 backdrop-blur-sm shadow-md shadow-black/60 ${className}`}
      aria-label={`${badge.age} ${badge.label}`}
    >
      <span
        aria-hidden="true"
        className={`${brandStyles.emoji} text-[32px] leading-none sm:text-[36px]`}
      >
        🔞
      </span>
      <span className="text-[19px] sm:text-[22px] font-black tracking-wider text-[#faab14]">
        {badge.label}
      </span>
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
    compact ? "h-[32px] min-w-[120px] px-3.5 text-[11px]" : "h-[60px] w-[254px] text-[24px]"
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
      className={`${brandStyles.signup} flex h-[48px] w-full max-w-[300px] items-center justify-center gap-2 rounded-[10px] bg-kink-gold-bright text-[17px] font-bold text-black`}
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
      className="flex h-[48px] w-full max-w-[300px] items-center justify-center gap-2 rounded-[10px] border border-kink-amber text-[17px] font-bold text-kink-gold-bright uppercase"
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
    <section className="w-full py-6 text-center" aria-label={label}>
      <h2
        className="flex items-center justify-center gap-2 whitespace-nowrap text-[clamp(14px,4.5vw,22px)] font-bold leading-tight text-kink-gold-bright"
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
      <p className="mx-auto mt-3 max-w-[440px] text-sm leading-6 text-kink-mist sm:text-base">
        {description}
      </p>
    </section>
  );
}

function PlatformOverview({ title, paragraphs }: SplashScreenProps["platformOverview"]) {
  return (
    <section className="w-full space-y-4 rounded-2xl border border-kink-amber/30 bg-kink-surface p-5 text-left">
      <h2 className="text-left text-xl font-bold text-kink-gold-bright">{title}</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-6 text-kink-paper">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

export default function SplashScreen({
  wordmark,
  hero,
  mobileHero,
  platformOverview,
  membership,
  downloadCta,
  brand,
  tagline,
  signUp,
  signIn,
  adultBadge,
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

      {/* Only the photo portion remains; the poster’s lower copy and buttons are live UI. */}
      <div className="flex min-h-dvh flex-col bg-black lg:hidden">
        <h1 className="sr-only">{brand}</h1>
        <div className="relative aspect-[720/900] w-full overflow-hidden">
          <Image
            src={mobileHero?.src ?? hero.src}
            alt={mobileHero?.alt ?? hero.alt}
            width={mobileHero?.width ?? 720}
            height={mobileHero?.height ?? 1080}
            preload
            unoptimized
            sizes="100vw"
            className="block h-auto w-full"
          />
          <div className="absolute inset-x-0 top-0 flex h-[12%] -translate-y-1 items-center justify-between px-3">
            <Image
              src={wordmark.src}
              alt={wordmark.alt}
              width={wordmark.width}
              height={wordmark.height}
              unoptimized
              preload
              className={`${brandStyles.wordmarkImage} h-[9vw] max-h-14 w-auto shrink-0`}
            />
            <span
              role="img"
              aria-label="Adults only, 18 plus"
              className={`${brandStyles.emoji} text-[7vw] leading-none sm:text-[44px]`}
            >
              🔞
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 px-5 pb-8 pt-2 sm:px-7">
          <div className="flex w-full max-w-[300px] flex-col gap-2.5">
            <SignUpButton cta={signUp} />
            <SignInButton cta={signIn} />
            <div className="flex justify-center pt-[30px]">
              <DownloadPill cta={downloadCta} compact />
            </div>
          </div>
          <div className="w-full max-w-[460px]">
            <MembershipCount {...membership} />
            <PlatformOverview {...platformOverview} />
          </div>
          <nav className="mt-2 w-full max-w-[347px] rounded-[20px] border border-kink-amber bg-kink-surface px-[22px]">
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
            <div className="mt-3 w-full max-w-[460px]">
              <StarDivider />
              <PolicyButtonsGrid links={policyLinks} />
            </div>
          )}
          <FooterNotice copyright={copyright} allRightsReserved={allRightsReserved} />
        </div>
      </div>

      {/* Desktop splash */}
      <div className="hidden lg:block">
        <div className="relative min-h-screen overflow-x-hidden bg-black pb-16">
          <div className="absolute right-0 top-0 h-[calc(100%-72px)] w-[48.15%]">
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              priority
              sizes="49vw"
              className="object-cover object-bottom"
            />
          </div>
          <div className="relative z-10 flex items-start justify-between pl-[94px] pr-[93px] pt-[37px]">
            <div className="flex items-center gap-4">
              <Image
                src={wordmark.src}
                alt={wordmark.alt}
                width={wordmark.width}
                height={wordmark.height}
                unoptimized
                className={`${brandStyles.wordmarkImage} h-[64px] w-auto`}
              />
            </div>
            <span
              role="img"
              aria-label="Adults only, 18 plus"
              className={`${brandStyles.emoji} text-5xl`}
            >
              🔞
            </span>
          </div>
          <div className="relative z-10 w-full max-w-[51.85%] pl-[64px] xl:pl-[118px] pr-8">
            <h1 className="mt-[120px] xl:mt-[160px] text-[72px] xl:text-[96px] font-extrabold leading-normal text-kink-gold-bright">
              {brand}
            </h1>
            <p className="mt-[16px] max-w-[635px] text-[20px] xl:text-[24px] font-semibold leading-normal text-kink-mist">
              {tagline}
            </p>

            {adultBadge && (
              <div className="mt-[28px] flex items-center gap-4">
                <AdultAgeBadge badge={adultBadge} />
                <div className="text-[14px] xl:text-[15px] font-bold leading-snug text-white">
                  <p>{adultBadge.line1}</p>
                  <p>{adultBadge.line2}</p>
                </div>
              </div>
            )}

            <div className="mt-[36px] flex flex-wrap gap-[20px] xl:gap-[38px]">
              <div className="w-full sm:w-[347px]">
                <SignUpButton cta={signUp} />
              </div>
              <div className="w-full sm:w-[347px]">
                <SignInButton cta={signIn} />
              </div>
            </div>
            <nav className="mt-[40px] flex flex-wrap gap-[16px] xl:gap-[25px]">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex h-[60px] min-w-[200px] xl:min-w-[216px] items-center justify-between gap-6 rounded-[10px] border border-kink-amber px-[24px] text-[18px] xl:text-[20px] font-bold text-kink-gold-bright transition hover:bg-white/5"
                >
                  {link.label}
                  <span className="text-kink-gold-bright">
                    <ChevronIcon />
                  </span>
                </Link>
              ))}
            </nav>

            <div className="mt-10 max-w-[732px]">
              <MembershipCount {...membership} />
              <PlatformOverview {...platformOverview} />
            </div>

            {policyLinks && policyLinks.length > 0 && (
              <div className="mt-[40px] max-w-[732px]">
                <StarDivider />
                <PolicyButtonsGrid links={policyLinks} />
              </div>
            )}
          </div>

          <FooterNotice copyright={copyright} allRightsReserved={allRightsReserved} />
        </div>
      </div>
    </div>
  );
}
