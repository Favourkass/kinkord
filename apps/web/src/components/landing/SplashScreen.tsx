import Image from "next/image";
import Link from "next/link";

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

export interface SplashScreenProps {
  logo: SplashImage;
  hero: SplashImage;
  downloadCta: SplashAction;
  brand: string;
  tagline: string;
  signUp: SplashLink;
  signIn: SplashLink;
  navLinks: SplashLink[];
  copyright: string;
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

function DownloadPill({ cta, compact }: { cta: SplashAction; compact?: boolean }) {
  const className = `grid place-items-center rounded-[24px] bg-kink-gold-deep font-extrabold tracking-[0.3px] text-black transition hover:brightness-110 active:scale-95 cursor-pointer ${
    compact ? "h-[28px] w-[119px] text-[10px]" : "h-[60px] w-[254px] text-[24px]"
  }`;

  if (cta.onClick) {
    return (
      <button type="button" onClick={cta.onClick} className={className}>
        {cta.label}
      </button>
    );
  }

  return (
    <Link href={cta.href ?? "#"} className={className}>
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
      className="flex h-[60px] w-full max-w-[347px] items-center justify-center gap-3 rounded-[10px] border border-kink-amber text-[20px] font-bold text-kink-gold-bright"
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
  navLinks,
  copyright,
}: SplashScreenProps) {
  return (
    <div className="min-h-dvh bg-black">
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
        <div className="absolute right-[22px] top-[40px] z-10">
          <DownloadPill cta={downloadCta} compact />
        </div>
        <div className="relative z-10 flex flex-1 flex-col items-center px-[27px]">
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
          <div className="min-h-[40px] flex-1" />
          <SignUpButton cta={signUp} />
          <div className="mt-3 w-full max-w-[347px]">
            <SignInButton cta={signIn} />
          </div>
          <nav className="mt-[29px] w-full max-w-[347px] rounded-[20px] border border-kink-amber bg-kink-surface px-[22px]">
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
          <p className="py-[7px] text-center text-[12px] font-medium text-kink-mist">{copyright}</p>
        </div>
      </div>

      {/* Desktop splash */}
      <div className="hidden lg:block">
        <div className="relative min-h-[max(100dvh,946px)] overflow-hidden bg-black">
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
          <div className="relative z-10 pl-[118px]">
            <h1 className="mt-[210px] text-[96px] font-extrabold leading-normal text-kink-gold-bright">
              {brand}
            </h1>
            <p className="mt-[16px] w-[635px] text-[24px] font-semibold leading-normal text-kink-mist">
              {tagline}
            </p>
            <div className="mt-[58px] flex gap-[38px]">
              <div className="w-[347px]">
                <SignUpButton cta={signUp} />
              </div>
              <div className="w-[347px]">
                <SignInButton cta={signIn} />
              </div>
            </div>
            <nav className="mt-[59px] flex gap-[25px]">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex h-[60px] min-w-[216px] items-center justify-between gap-6 rounded-[10px] border border-kink-amber px-[24px] text-[20px] font-bold text-white"
                >
                  {link.label}
                  <span className="text-kink-gold-bright">
                    <ChevronIcon />
                  </span>
                </Link>
              ))}
            </nav>
          </div>
          <p className="absolute inset-x-0 bottom-[37px] z-10 text-center text-[20px] font-medium text-kink-mist">
            {copyright}
          </p>
        </div>
      </div>
    </div>
  );
}
