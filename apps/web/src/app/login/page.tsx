"use client";

import Image from "next/image";
import Link from "next/link";
import AuthField from "@/components/auth/AuthField";
import AuthCheckbox from "@/components/auth/AuthCheckbox";
import AmberCta from "@/components/auth/AmberCta";
import AgePill from "@/components/auth/AgePill";
import AuthFooter from "@/components/auth/AuthFooter";
import CodeInput from "@/components/auth/CodeInput";
import {
  BackChevronIcon,
  HeartIcon,
  PadlockIcon,
  UserFieldIcon,
} from "@/components/auth/AuthIcons";
import { useLoginPresenter } from "@/presenters/useLoginPresenter";
import { Routes } from "@/constants/Routes";

const FOOTER_LINKS = [
  { label: "Help", href: Routes.contact },
  { label: "Language", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "© Temaxiro", href: Routes.about, gold: true },
];

export default function LoginPage() {
  const p = useLoginPresenter();

  return (
    <div className="min-h-dvh bg-kink-night lg:bg-black">
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-[29px] pb-8 lg:max-w-[1280px] lg:px-[105px] lg:pb-6">
        <div className="relative pt-[44px] lg:pt-[22px]">
          <Link
            href={Routes.home}
            aria-label="Back to home"
            className="absolute left-0 top-[44px] grid size-10 place-items-center text-white lg:hidden"
          >
            <BackChevronIcon />
          </Link>
          <Image
            src="/brand/logo-badge.png"
            alt="Kinkord"
            width={145}
            height={145}
            priority
            unoptimized
            className="mx-auto mt-[47px] size-[145px] lg:mx-0 lg:mt-0 lg:size-[79px]"
          />
        </div>

        {!p.needsTwoFactor ? (
          <>
            <h1 className="mt-[14px] text-center text-[36px] font-black leading-tight text-kink-gold-bright lg:mt-[11px] lg:text-left lg:text-[64px]">
              Welcome Back<span className="hidden lg:inline">!</span>
            </h1>
            <p className="mt-2 flex items-center justify-center gap-2 text-[20px] font-medium text-white lg:justify-start lg:text-[32px]">
              We’ve missed you
              <span className="text-kink-amber [&>svg]:size-[19px] lg:[&>svg]:size-[37px]">
                <HeartIcon />
              </span>
            </p>

            <form
              className="mt-7 lg:mt-12"
              onSubmit={(e) => {
                e.preventDefault();
                void p.submit();
              }}
            >
              <div className="space-y-2 lg:space-y-8">
                <AuthField
                  label="Email, Phone Number or Username"
                  icon={<UserFieldIcon />}
                  placeholder="Enter your email, phone or username"
                  autoComplete="username"
                  value={p.identifier}
                  onChange={p.setIdentifier}
                />
                <AuthField
                  label="Password"
                  icon={<PadlockIcon />}
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={p.password}
                  onChange={p.setPassword}
                />
              </div>

              <div className="mt-5 flex items-center justify-between lg:mt-8">
                <AuthCheckbox
                  label="Keep me logged in"
                  checked={p.rememberMe}
                  onChange={p.setRememberMe}
                />
                <Link
                  href={Routes.forgotPassword}
                  className="text-[15px] font-semibold text-white lg:text-[20px]"
                >
                  Forgot Password?
                </Link>
              </div>

              {p.error && (
                <p className="mt-4 text-center text-[14px] text-red-400 lg:text-[16px]">
                  {p.error}
                </p>
              )}

              <div className="mt-8 flex justify-center lg:mt-7">
                <AmberCta label="login" type="submit" loading={p.busy} className="lg:w-[620px]" />
              </div>
            </form>

            <p className="mt-6 text-center text-[14px] font-medium text-white lg:text-[20px] lg:font-semibold">
              Don’t have an account?{" "}
              <Link href={Routes.signup} className="text-kink-gold-bright">
                Sign Up
              </Link>
            </p>

            <div className="mx-auto mt-7 w-full max-w-[354px] lg:mt-6 lg:max-w-[538px]">
              <AgePill lead="18+ Only." rest="You must be 18 or older to use Kinkord." />
            </div>
          </>
        ) : (
          <section className="mx-auto mt-10 flex w-full max-w-[640px] flex-col items-center gap-7 text-center lg:mt-16">
            <div>
              <h1 className="text-[32px] font-black leading-tight text-kink-gold-bright lg:text-[48px]">
                Two-Factor Authentication
              </h1>
              <p className="mt-2 text-[15px] font-light text-kink-soft lg:text-[20px]">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>
            <CodeInput value={p.code} onChange={p.setCode} />
            {p.error && <p className="text-[14px] text-red-400 lg:text-[16px]">{p.error}</p>}
            <AmberCta
              label="Verify"
              onClick={p.submitTwoFactor}
              loading={p.busy}
              className="max-w-[480px]"
            />
          </section>
        )}

        <div className="flex-1" />
        <div className="pt-10">
          <AuthFooter links={FOOTER_LINKS} />
        </div>
      </div>
    </div>
  );
}
