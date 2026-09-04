import Image from "next/image";
import Link from "next/link";
import { Cookie, Copyright, FileText, Lock, Shield, ShieldAlert, Users } from "lucide-react";
import AgeGateModal from "@/components/ui/AgeGateModal";

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
  icon: "privacy" | "terms" | "guidelines" | "cookie" | "safety" | "copyright";
}

export interface AdultBadgeData {
  age: string;
  label: string;
  line1: string;
  line2: string;
}

export interface SplashScreenProps {
  logo: SplashImage;
  hero: SplashImage;
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
    <span aria-hidden className="grid size-5 place-items-center text-[#faab14]">
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" overflow="visible">
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

function StarDivider() {
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
      <div className="flex size-[32px] sm:size-[36px] items-center justify-center rounded-full border-[1.5px] border-[#faab14]">
        <span className="text-[13px] sm:text-[14px] font-extrabold tracking-tight text-[#faab14]">
          {badge.age}
        </span>
      </div>
      <span className="text-[19px] sm:text-[22px] font-black tracking-wider text-[#faab14]">
        {badge.label}
      </span>
    </div>
  );
}

function PolicyIcon({ type }: { type: PolicyItem["icon"] }) {
  switch (type) {
    case "privacy":
      return <Shield className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "terms":
      return <FileText className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "guidelines":
      return <Users className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "cookie":
      return <Cookie className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "safety":
      return <ShieldAlert className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    case "copyright":
      return <Copyright className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
    default:
      return <Shield className="size-[20px] sm:size-[22px] text-[#faab14]" aria-hidden />;
  }
}

function PolicyButtonsGrid({ links }: { links: PolicyItem[] }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3.5">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="flex h-[52px] sm:h-[58px] items-center justify-between rounded-[12px] border border-[#faab14]/40 bg-[#0c0c0b] px-3 sm:px-4 text-white transition hover:border-[#faab14] hover:bg-[#181815] active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="shrink-0">
              <PolicyIcon type={link.icon} />
            </span>
            <span className="truncate text-[11px] sm:text-[14px] lg:text-[15px] font-medium text-white">
              {link.label}
            </span>
          </div>
          <PolicyChevron />
        </Link>
      ))}
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
      <p className="text-[12px] sm:text-[14px] font-medium text-kink-mist">{copyright}</p>
      {allRightsReserved && (
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] sm:text-[13px] font-medium text-kink-mist">
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
      className="flex h-[60px] w-full max-w-[347px] items-center justify-center gap-3 rounded-[10px] bg-kink-gold-bright text-[20px] font-bold text-black"
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
      className="flex h-[60px] w-full max-w-[347px] items-center justify-center gap-3 rounded-[10px] border border-kink-amber text-[20px] font-bold text-kink-gold-bright uppercase"
    >
      <SignInIcon />
      {cta.label}
    </Link>
  );
}

export default function SplashScreen({
  logo,
  hero,
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

      {/* Mobile splash */}
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black lg:hidden">
        <div className="absolute inset-x-0 top-0 bottom-[28px] overflow-hidden">
          <div className="absolute left-[-0.46%] top-[-10.13%] h-full w-[100.55%]">
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </div>
        <div className="absolute right-[22px] top-[max(env(safe-area-inset-top,0px)+16px,36px)] z-30 pointer-events-auto">
          <DownloadPill cta={downloadCta} compact />
        </div>
        <div className="relative z-10 flex flex-1 flex-col items-center px-[22px] sm:px-[27px] pb-8">
          <Image
            src={logo.src}
            alt={logo.alt}
            width={145}
            height={145}
            priority
            unoptimized
            className="mt-[68px] size-[145px]"
          />
          <h1 className="text-center text-[48px] font-extrabold leading-tight text-kink-amber">
            {brand}
          </h1>
          <p className="mt-1 max-w-[318px] text-center text-[15px] font-extrabold leading-normal text-white">
            {tagline}
          </p>

          {adultBadge && (
            <div className="my-6 flex flex-col items-center text-center">
              <AdultAgeBadge badge={adultBadge} />
              <div className="mt-2.5 text-[13.5px] font-bold leading-tight text-white">
                <p>{adultBadge.line1}</p>
                <p>{adultBadge.line2}</p>
              </div>
            </div>
          )}

          <SignUpButton cta={signUp} />
          <div className="mt-3 w-full max-w-[347px]">
            <SignInButton cta={signIn} />
          </div>
          <nav className="mt-[24px] w-full max-w-[347px] rounded-[20px] border border-kink-amber bg-kink-surface px-[22px]">
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex h-[52px] items-center justify-between text-[15px] font-extrabold tracking-[0.3px] text-kink-paper ${
                  i > 0 ? "border-t border-kink-divider" : ""
                }`}
              >
                {link.label}
                <span className="text-white">
                  <ChevronIcon />
                </span>
              </Link>
            ))}
          </nav>

          {policyLinks && policyLinks.length > 0 && (
            <div className="mt-7 w-full max-w-[347px] sm:max-w-[440px]">
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
            <Image src={logo.src} alt={logo.alt} width={98} height={98} priority unoptimized />
            <DownloadPill cta={downloadCta} />
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
                  className="flex h-[60px] min-w-[200px] xl:min-w-[216px] items-center justify-between gap-6 rounded-[10px] border border-kink-amber px-[24px] text-[18px] xl:text-[20px] font-bold text-white transition hover:bg-white/5"
                >
                  {link.label}
                  <span className="text-kink-gold-bright">
                    <ChevronIcon />
                  </span>
                </Link>
              ))}
            </nav>

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
