"use client";

import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import type { AboutVM } from "@/presenters/useAboutPresenter";
import { StarDivider, PolicyButtonsGrid } from "@/components/landing/SplashScreen";

/* --- Icons --- */

function HamburgerMenuIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 2.5H26.5M1.5 10H26.5M1.5 17.5H26.5"
        stroke="#ffba1f"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeNavIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ChatNavIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SettingsNavIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutNavIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ProfileAvatarIcon({ avatarUrl }: { avatarUrl: string | null }) {
  return (
    <div className="relative size-[26px] overflow-hidden rounded-full ring-1 ring-[#ffba1f]/60">
      <Image
        src={avatarUrl || "/app/avatar-default.jpg"}
        alt="Profile"
        fill
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

export default function AboutPage({
  brand,
  aboutTitle,
  aboutTitleAccent,
  meetTeamCta,
  meetTeamSubtitle,
  teamHref,
  policyLinks,
  copyright,
  allRightsReserved,
  drawerOpen,
  openDrawer,
  closeDrawer,
  onLogout,
  navLinks,
  bottomNav,
  isLoggedIn,
  loginHref,
  signupHref,
}: AboutVM) {
  return (
    <div className="flex min-h-screen bg-black text-white selection:bg-[#ffba1f] selection:text-black">
      {/* Desktop Left Sidebar (Only visible when user is logged in) */}
      {isLoggedIn && (
        <aside className="hidden w-[280px] shrink-0 sticky top-0 h-screen flex-col bg-[#1e1e1e] pt-[44px] pb-[44px] px-[36px] z-20 lg:flex">
          <Link
            href={bottomNav.homeHref}
            className="text-[34px] font-black tracking-[2px] text-[#ffba1f] transition-opacity hover:opacity-90 mb-[44px]"
          >
            {brand}
          </Link>

          <nav className="flex flex-col gap-[28px]">
            <Link
              href={bottomNav.homeHref}
              className="flex items-center gap-[18px] text-[20px] font-medium text-white transition-opacity hover:opacity-80"
            >
              <HomeNavIcon />
              <span>Home</span>
            </Link>

            <Link
              href={bottomNav.messagesHref}
              className="flex items-center gap-[18px] text-[20px] font-medium text-white transition-opacity hover:opacity-80"
            >
              <ChatNavIcon />
              <span>Chat</span>
            </Link>

            <Link
              href={bottomNav.settingsHref}
              className="flex items-center gap-[18px] text-[20px] font-medium text-white transition-opacity hover:opacity-80"
            >
              <SettingsNavIcon />
              <span>Settings</span>
            </Link>

            <Link
              href={bottomNav.profileHref}
              className="flex items-center gap-[18px] text-[20px] font-medium text-white transition-opacity hover:opacity-80"
            >
              <ProfileAvatarIcon avatarUrl={bottomNav.avatarUrl} />
              <span>Profile</span>
            </Link>
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className="mt-auto flex items-center gap-[18px] text-[20px] font-medium text-white transition-opacity hover:opacity-80 cursor-pointer text-left"
          >
            <LogoutNavIcon />
            <span>Log Out</span>
          </button>
        </aside>
      )}

      {/* Mobile Slide-Out Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-neutral-800 bg-[#0d0d0d] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
              <span className="text-xl font-extrabold tracking-wider text-[#ffba1f]">{brand}</span>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-2">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={closeDrawer}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-800/60 hover:text-[#ffba1f]"
                >
                  {item.label}
                </Link>
              ))}
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    closeDrawer();
                    void onLogout();
                  }}
                  className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-neutral-400 transition-colors hover:bg-neutral-800/60 hover:text-white text-left"
                >
                  <LogoutNavIcon />
                  <span>Log Out</span>
                </button>
              )}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-20 lg:px-14 lg:py-12">
        <div className="mx-auto w-full max-w-[480px] sm:max-w-[560px] lg:max-w-[760px]">
          {/* Top Header */}
          <header className={`flex items-center justify-between py-2 mb-6 ${isLoggedIn ? "lg:hidden" : ""}`}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={openDrawer}
                className="flex items-center justify-center p-1 transition-transform active:scale-95 cursor-pointer"
                aria-label="Open menu"
              >
                <HamburgerMenuIcon />
              </button>
              <Link href={bottomNav.homeHref} className="text-2xl font-black tracking-wider text-[#ffba1f]">
                {brand}
              </Link>
            </div>
            {!isLoggedIn && (
              <div className="flex items-center gap-3">
                <Link
                  href={loginHref}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-white border border-[#faab14]/40 hover:border-[#faab14] transition"
                >
                  Log In
                </Link>
                <Link
                  href={signupHref}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-black bg-[#ffba1f] hover:bg-[#faab14] transition"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </header>

          <div className="flex flex-col items-center animate-fadeIn">
            {/* Hero Title & Key Logo Emblem */}
            <div className="flex w-full items-center justify-between pt-2 pb-6">
              <div>
                <div className="h-1.5 w-12 rounded-full bg-[#ffba1f] mb-3" />
                <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-wide text-white leading-tight">
                  {aboutTitle}
                </h1>
                <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-wide text-[#faab14] leading-tight">
                  {aboutTitleAccent}
                </h1>
              </div>

              {/* The Key Component: Gold Kinkord Emblem Logo */}
              <div className="relative size-[90px] sm:size-[110px] shrink-0 drop-shadow-[0_0_20px_rgba(250,171,20,0.35)]">
                <Image
                  src="/brand/k-logo-badge.png"
                  alt="Kinkord Key Emblem"
                  fill
                  priority
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>

            {/* The Key CTA Button: MEET THE TEAM (links to dedicated /about/team page) */}
            <div className="my-6 w-full text-center">
              <Link
                href={teamHref}
                className="w-full h-[60px] rounded-[24px] bg-[#faab14] hover:bg-[#ffba1f] text-black font-extrabold text-[17px] sm:text-[18px] tracking-wider shadow-[0_6px_28px_rgba(250,171,20,0.45)] transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer grid place-items-center"
              >
                {meetTeamCta}
              </Link>
              <p className="mt-3 text-[13px] sm:text-[14px] text-neutral-400 font-medium">
                {meetTeamSubtitle}
              </p>
            </div>

            {/* Star Divider & 10 Policy Buttons Grid */}
            <div className="mt-4 w-full">
              <StarDivider />
              <PolicyButtonsGrid links={policyLinks} />
            </div>

            {/* Footer */}
            <footer className="mt-8 text-center text-xs text-neutral-500 font-medium space-y-1.5 pb-6">
              <p>{copyright}</p>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
                <Lock className="size-3 text-[#faab14]" aria-hidden="true" />
                <span>{allRightsReserved}</span>
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
