"use client";

import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import type { TeamVM } from "@/presenters/useTeamPresenter";
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

function BackChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "text-neutral-500" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function VerifiedBadgeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#faab14" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function BriefcaseIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
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

function TopicIcon({ id, className = "size-4 sm:size-4.5" }: { id: string; className?: string }) {
  switch (id) {
    case "my-kink-identity":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      );
    case "what-i-believe":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    case "the-journey-so-far":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      );
    case "lesson-setback-growth":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="m2 20 7-7 4 4 9-9" />
          <path d="M14 8h8v8" />
        </svg>
      );
    case "my-mission":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "my-vision":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "what-im-building":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect width="8" height="8" x="3" y="3" rx="1" />
          <rect width="8" height="8" x="13" y="3" rx="1" />
          <rect width="8" height="8" x="8" y="13" rx="1" />
        </svg>
      );
    case "founders-journey":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      );
    case "contact-the-founder":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case "work-with-me":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "my-message-to-the-community":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="m3 11 18-5v12L3 13v-2z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    case "founders-principle":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m10 15 5-3-5-3v6z" />
        </svg>
      );
  }
}

export default function TeamPage({
  brand,
  teamTitle,
  teamTitleAccent,
  memberProfileTitle,
  joinTeamCta,
  joinTeamSubtitle,
  founderMessage,
  ceo,
  founderTopics,
  selectedTopicId,
  selectedTopic,
  selectTopic,
  clearTopic,
  policyLinks,
  copyright,
  allRightsReserved,
  drawerOpen,
  openDrawer,
  closeDrawer,
  onLogout,
  navLinks,
  bottomNav,
  showProfile,
  openProfile,
  closeProfile,
  isLoggedIn,
  loginHref,
  signupHref,
}: TeamVM) {
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
          {/* Header Bar */}
          {showProfile ? (
            /* Member Profile Header */
            <header className="flex items-center justify-between py-3 mb-4">
              <button
                type="button"
                onClick={selectedTopic ? clearTopic : closeProfile}
                className="flex items-center gap-1.5 text-[#ffba1f] font-bold text-[15px] transition-transform active:scale-95 cursor-pointer"
                aria-label={selectedTopic ? "Back to Member Profile" : "Back to Team"}
              >
                <BackChevronIcon />
                <span>{selectedTopic ? "Profile" : "Back"}</span>
              </button>
              <h2 className="text-[14px] sm:text-[16px] font-black tracking-widest text-[#ffba1f] uppercase truncate max-w-[220px] text-center">
                {selectedTopic ? selectedTopic.title : memberProfileTitle}
              </h2>
              <div className="w-12" aria-hidden="true" />
            </header>
          ) : (
            /* Standard Mobile Header */
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
          )}

          {/* DEDICATED MEET THE TEAM VIEW (Image 2) */}
          {!showProfile && (
            <div className="flex flex-col items-center animate-fadeIn">
              {/* Hero Title & Key Logo Emblem */}
              <div className="flex w-full items-center justify-between pt-2 pb-6">
                <div>
                  <div className="h-1.5 w-12 rounded-full bg-[#ffba1f] mb-3" />
                  <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-wide text-white leading-tight">
                    {teamTitle}
                  </h1>
                  <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-wide text-[#faab14] leading-tight">
                    {teamTitleAccent}
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

              {/* Message from the Founder */}
              <section className="w-full my-4">
                <div className="h-1 w-10 rounded-full bg-[#ffba1f] mb-2.5" />
                <h2 className="text-[18px] sm:text-[20px] font-bold text-[#ffba1f] mb-3">
                  {founderMessage.badge}
                </h2>
                <div className="space-y-3.5 text-[13px] sm:text-[14px] leading-relaxed text-neutral-300 font-normal">
                  {founderMessage.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <div className="mt-5">
                  <p className="text-[15px] font-bold text-[#ffba1f]">{founderMessage.founderName}</p>
                  <p className="text-[12px] text-neutral-400">{founderMessage.founderRole}</p>
                </div>
              </section>

              {/* Team Members List (CEO Alone per requirement) */}
              <section className="w-full my-6">
                <button
                  type="button"
                  onClick={openProfile}
                  className="group w-full rounded-[20px] border border-neutral-800 bg-[#0e0e0c] p-3.5 sm:p-4 hover:border-[#faab14]/50 hover:bg-[#151512] transition-all cursor-pointer flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3.5">
                    {/* CEO Avatar */}
                    <div className="relative size-[68px] sm:size-[76px] shrink-0 rounded-[16px] overflow-hidden bg-neutral-900 border border-neutral-700/60 shadow-lg">
                      <Image
                        src={ceo.avatarUrl}
                        alt={ceo.name}
                        fill
                        className="object-cover object-center"
                        unoptimized
                      />
                    </div>

                    {/* CEO Info */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                          {ceo.handle}
                        </span>
                        {ceo.verified && <VerifiedBadgeIcon />}
                      </div>
                      <p className="text-[16px] sm:text-[17px] font-bold text-white group-hover:text-[#faab14] transition-colors mt-0.5">
                        {ceo.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium text-neutral-300 mt-0.5">
                        <BriefcaseIcon className="size-3.5 text-[#faab14]" />
                        <span>{ceo.role}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] sm:text-[12px] text-neutral-400 mt-1">
                        <span>👤 {ceo.age}</span>
                        <span>📍 {ceo.location}</span>
                        <span>♂ {ceo.gender}</span>
                      </div>
                    </div>
                  </div>

                  {/* Chevron Right */}
                  <div className="pr-1">
                    <ChevronRightIcon className="text-neutral-500 group-hover:text-[#faab14] group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              </section>

              {/* Join Kinkord Team CTA */}
              <div className="my-4 w-full text-center">
                <Link
                  href="/contact"
                  className="w-full h-[58px] rounded-[24px] bg-[#faab14] hover:bg-[#ffba1f] text-black font-extrabold text-[17px] sm:text-[18px] tracking-wider shadow-[0_4px_24px_rgba(250,171,20,0.4)] transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer grid place-items-center"
                >
                  {joinTeamCta}
                </Link>
                <p className="mt-3 text-[13px] sm:text-[14px] text-neutral-400 font-medium">
                  {joinTeamSubtitle}
                </p>
              </div>
            </div>
          )}

          {/* MEMBER PROFILE VIEW (Image 3) */}
          {showProfile && !selectedTopic && (
            <div className="flex flex-col items-center space-y-4 animate-fadeIn">
              {/* Main Card */}
              <div className="w-full rounded-[24px] border border-neutral-800 bg-[#0e0e0c] p-6 text-center shadow-xl">
                <div className="relative size-[104px] sm:size-[116px] mx-auto rounded-full overflow-hidden ring-[2.5px] ring-[#faab14] ring-offset-4 ring-offset-black shadow-[0_0_24px_rgba(250,171,20,0.25)]">
                  <Image
                    src={ceo.avatarUrl}
                    alt={ceo.name}
                    fill
                    className="object-cover object-center"
                    unoptimized
                  />
                </div>

                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-800/80 px-2.5 py-0.5 text-[12px] font-medium text-neutral-300">
                  <span>{ceo.handle}</span>
                  {ceo.verified && <VerifiedBadgeIcon />}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">{ceo.name}</h1>
                <p className="text-[15px] sm:text-[16px] font-semibold text-[#faab14] mt-0.5">
                  {ceo.role}
                </p>

                <div className="my-4 border-t border-neutral-800/80" />

                <div className="flex items-center justify-center gap-4 text-[13px] sm:text-[14px] text-neutral-400">
                  <span>{ceo.location}</span>
                  <span>•</span>
                  <span>{ceo.gender}, {ceo.age}</span>
                </div>
              </div>

              {/* ABOUT ME Card */}
              <div className="w-full rounded-[20px] border border-neutral-800 bg-[#0e0e0c] p-5 sm:p-6 shadow-md text-left">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1.5 rounded-full bg-[#faab14]" />
                  <h3 className="text-[14px] sm:text-[15px] font-bold tracking-wider text-white uppercase">
                    ABOUT ME
                  </h3>
                </div>
                <div className="mt-3.5 space-y-3 text-[13px] sm:text-[14px] leading-relaxed text-neutral-300 font-normal">
                  {ceo.bio.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>

              {/* 12 BUTTONS LIST ACCORDING TO IMAGE SAMPLE */}
              <div className="w-full pt-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-4 w-1.5 rounded-full bg-[#faab14]" />
                  <h3 className="text-[14px] sm:text-[15px] font-bold tracking-wider text-white uppercase">
                    FOUNDER'S PERSPECTIVES
                  </h3>
                </div>

                {/* 2-Column Button Grid matching Image Sample */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
                  {founderTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => selectTopic(topic.id)}
                      className="group flex items-center justify-between min-h-[58px] rounded-[18px] border border-neutral-800/90 bg-[#0e0e0c] px-3 sm:px-3.5 py-3 hover:border-[#faab14]/70 hover:bg-[#151512] transition-all cursor-pointer text-left shadow-sm active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <span className="shrink-0 text-[#faab14]">
                          <TopicIcon id={topic.id} className="size-4 sm:size-[18px]" />
                        </span>
                        <span className="text-[12px] sm:text-[13px] font-semibold text-neutral-200 group-hover:text-white line-clamp-2 leading-tight">
                          {topic.title}
                        </span>
                      </div>
                      <ChevronRightIcon className="size-4 shrink-0 text-neutral-500 group-hover:text-[#faab14] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              {/* GET IN TOUCH Card */}
              <div className="w-full rounded-[20px] border border-neutral-800 bg-[#0e0e0c] p-5 sm:p-6 shadow-md text-left mt-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1.5 rounded-full bg-[#faab14]" />
                  <h3 className="text-[14px] sm:text-[15px] font-bold tracking-wider text-white uppercase">
                    GET IN TOUCH
                  </h3>
                </div>
                <div className="mt-3 space-y-2.5">
                  <a
                    href={`mailto:${ceo.email}`}
                    className="block text-[14px] text-neutral-300 hover:text-[#faab14] transition-colors"
                  >
                    {ceo.email}
                  </a>
                  <div className="border-t border-neutral-800/80" />
                  <p className="text-[14px] text-neutral-300">{ceo.communityHandle}</p>
                </div>
              </div>
            </div>
          )}

          {/* IN-PAGE TOPIC DETAIL VIEW (Content changes when button is clicked) */}
          {showProfile && selectedTopic && (
            <div className="flex flex-col items-center space-y-4 animate-fadeIn">
              {/* Mini Founder Header */}
              <div className="flex items-center justify-between w-full rounded-[20px] border border-neutral-800/80 bg-[#0e0e0c] p-3.5 sm:p-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="relative size-[46px] shrink-0 rounded-full overflow-hidden ring-[1.5px] ring-[#faab14]">
                    <Image
                      src={ceo.avatarUrl}
                      alt={ceo.name}
                      fill
                      className="object-cover object-center"
                      unoptimized
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] sm:text-[15px] font-bold text-white">{ceo.name}</span>
                      <VerifiedBadgeIcon />
                    </div>
                    <p className="text-[12px] text-[#faab14] font-medium">{ceo.role} • {ceo.handle}</p>
                  </div>
                </div>
                <span className="rounded-full bg-neutral-800/90 px-2.5 py-1 text-[11px] font-semibold text-[#faab14] border border-[#faab14]/20">
                  {selectedTopic.badge}
                </span>
              </div>

              {/* Main Content Card for Selected Topic */}
              <div className="w-full rounded-[24px] border border-neutral-800 bg-[#0e0e0c] p-5 sm:p-7 shadow-xl text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#faab14]/10 text-[#faab14] border border-[#faab14]/30 shrink-0">
                    <TopicIcon id={selectedTopic.id} className="size-6" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#faab14] font-bold">
                      Founder's Perspective
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      {selectedTopic.title}
                    </h2>
                  </div>
                </div>

                <div className="border-t border-neutral-800/80 my-4" />

                {/* Topic Content & Paragraphs */}
                <div className="space-y-4 text-[14px] sm:text-[15px] leading-relaxed text-neutral-300 font-normal">
                  {selectedTopic.paragraphs.length > 0 && (
                    <p className="whitespace-pre-line">{selectedTopic.paragraphs[0]}</p>
                  )}

                  {/* My Role block (if present) */}
                  {selectedTopic.role && (
                    <div className="rounded-[18px] border border-neutral-800/90 bg-[#121210] p-4 my-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-3.5 w-1.5 rounded-full bg-[#faab14]" />
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#faab14]">
                          My Role
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#faab14]/40 bg-[#faab14]/10 px-3.5 py-1 text-[13px] sm:text-[14px] font-bold text-[#ffba1f]">
                        👑 {selectedTopic.role}
                      </div>
                    </div>
                  )}

                  {/* My Interests block (if present) */}
                  {selectedTopic.interests && selectedTopic.interests.length > 0 && (
                    <div className="rounded-[18px] border border-neutral-800/90 bg-[#121210] p-4 my-2">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="h-3.5 w-1.5 rounded-full bg-[#faab14]" />
                        <span className="text-[12px] font-bold uppercase tracking-wider text-[#faab14]">
                          My Interests
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTopic.interests.map((interest) => (
                          <span
                            key={interest}
                            className="inline-flex items-center rounded-full border border-neutral-700/80 bg-neutral-800/80 px-3.5 py-1.5 text-[12.5px] sm:text-[13px] font-medium text-neutral-200 shadow-sm"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remaining paragraphs (if any) */}
                  {selectedTopic.paragraphs.slice(1).map((para, i) => (
                    <p key={i} className="whitespace-pre-line">{para}</p>
                  ))}
                </div>

                {/* Journal Entries List (if present) */}
                {selectedTopic.journalEntries && selectedTopic.journalEntries.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-4">
                    {selectedTopic.journalEntries.map((entry, idx) => (
                      <article
                        key={idx}
                        className="rounded-[20px] border border-neutral-800/90 bg-[#121210] p-4 sm:p-5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800/80 px-2.5 py-1 text-[11px] font-semibold text-[#faab14] border border-[#faab14]/20">
                            📅 {entry.date}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-medium">
                            Entry #{selectedTopic.journalEntries!.length - idx}
                          </span>
                        </div>

                        {entry.title && (
                          <h3 className="text-[15px] sm:text-[16px] font-bold text-white leading-snug">
                            {entry.title}
                          </h3>
                        )}

                        <div className="space-y-2.5 text-[13.5px] sm:text-[14px] leading-relaxed text-neutral-300">
                          {entry.paragraphs.map((para, pIdx) => (
                            <p key={pIdx} className="whitespace-pre-line">{para}</p>
                          ))}
                        </div>

                        {entry.quote && (
                          <blockquote className="my-2.5 border-l-2 border-[#faab14] pl-3.5 py-1 text-white font-bold italic text-[14px] sm:text-[15px] bg-[#faab14]/5 rounded-r-xl">
                            {entry.quote}
                          </blockquote>
                        )}

                        {entry.closing && (
                          <p className="font-semibold text-[#ffba1f] text-[13px] sm:text-[14px]">
                            {entry.closing}
                          </p>
                        )}

                        {entry.whatsappUrl && (
                          <div className="pt-2">
                            <a
                              href={entry.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-[50px] rounded-[16px] bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-[14px] sm:text-[15px] tracking-wide shadow-[0_4px_20px_rgba(37,211,102,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span className="text-lg" aria-hidden="true">💬</span>
                              <span>{entry.whatsappLabel || "Contact on WhatsApp"}</span>
                            </a>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {/* Special Action: Contact Channels Grid */}
                {selectedTopic.contactChannels && selectedTopic.contactChannels.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-800/80">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedTopic.contactChannels.map((channel) => (
                        <a
                          key={channel.name}
                          href={channel.href}
                          target={channel.href.startsWith("http") ? "_blank" : undefined}
                          rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="group flex items-start gap-3 rounded-[18px] border border-neutral-800/90 bg-[#121210] p-3.5 hover:border-[#faab14]/60 hover:bg-[#181814] transition-all cursor-pointer text-left shadow-sm active:scale-[0.99]"
                        >
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-800/80 text-xl border border-neutral-700/50 group-hover:border-[#faab14]/40 transition-colors">
                            <span aria-hidden="true">{channel.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] sm:text-[14px] font-bold text-white group-hover:text-[#faab14] transition-colors">
                                {channel.name}
                              </span>
                              <ChevronRightIcon className="size-3.5 text-neutral-500 group-hover:text-[#faab14] group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                            <p className="text-[12px] font-semibold text-[#ffba1f] truncate mt-0.5">
                              {channel.handle}
                            </p>
                            <p className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5 leading-snug">
                              {channel.description}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Principles List (if present) */}
                {selectedTopic.principles && selectedTopic.principles.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-3">
                    {selectedTopic.principles.map((principle, idx) => {
                      const num = principle.number ?? idx + 1;
                      return (
                        <div
                          key={principle.title}
                          className="rounded-[20px] border border-neutral-800/90 bg-[#121210] p-4 sm:p-5 shadow-sm space-y-2 hover:border-[#faab14]/40 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#faab14]/15 border border-[#faab14]/30 text-xs font-black text-[#ffba1f]">
                              {num}
                            </span>
                            <span className="text-xl shrink-0" aria-hidden="true">
                              {principle.icon}
                            </span>
                            <h3 className="text-[15px] sm:text-[16px] font-black text-white leading-tight">
                              {principle.title}
                            </h3>
                          </div>
                          <p className="text-[13.5px] sm:text-[14px] text-neutral-300 leading-relaxed sm:pl-[38px]">
                            {principle.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Closing Note (if present) */}
                {selectedTopic.closingNote && (
                  <div className="rounded-[18px] border border-neutral-800/90 bg-[#121210] p-4 text-neutral-300 text-[13px] sm:text-[14px] whitespace-pre-line leading-relaxed mt-4">
                    {selectedTopic.closingNote}
                  </div>
                )}

                {/* Special Action for WhatsApp contact / recruitment */}
                {selectedTopic.whatsappUrl && (
                  <div className="mt-6 pt-5 border-t border-neutral-800/80 space-y-3">
                    <a
                      href={selectedTopic.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-[54px] rounded-[20px] bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-[15px] sm:text-[16px] tracking-wide shadow-[0_4px_24px_rgba(37,211,102,0.35)] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <span className="text-xl" aria-hidden="true">💬</span>
                      <span>{selectedTopic.whatsappLabel || "Contact on WhatsApp"}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Back to All Topics Button */}
              <button
                type="button"
                onClick={clearTopic}
                className="w-full h-[52px] rounded-[20px] border border-neutral-800 hover:border-[#faab14]/50 bg-[#121210] hover:bg-[#181814] text-white font-semibold text-[14px] sm:text-[15px] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <BackChevronIcon />
                <span>Back to All Founder Topics</span>
              </button>

              {/* Other Topics Quick Switcher */}
              <div className="w-full pt-2">
                <p className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                  Explore More Topics
                </p>
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {founderTopics
                    .filter((t) => t.id !== selectedTopic.id)
                    .slice(0, 4)
                    .map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => selectTopic(topic.id)}
                        className="group flex items-center justify-between rounded-[16px] border border-neutral-800/90 bg-[#0e0e0c] px-3 py-2.5 hover:border-[#faab14]/50 hover:bg-[#151512] transition-all cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span className="shrink-0 text-[#faab14]">
                            <TopicIcon id={topic.id} className="size-4" />
                          </span>
                          <span className="text-[11.5px] sm:text-[12.5px] font-medium text-neutral-300 group-hover:text-white line-clamp-1">
                            {topic.title}
                          </span>
                        </div>
                        <ChevronRightIcon className="size-3.5 shrink-0 text-neutral-500 group-hover:text-[#faab14]" />
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Star Divider & 10 Policy Buttons Grid */}
          <div className="mt-8 w-full">
            <StarDivider />
            <PolicyButtonsGrid links={policyLinks} />
          </div>

          {/* Footer with Gold Divider */}
          <footer className="mt-6 w-full text-center text-xs text-neutral-500 font-medium space-y-1.5 pb-8">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-[#faab14]/40 to-transparent mb-6" />
            <p className="text-[13px] text-neutral-400">{copyright}</p>
            <p className="flex items-center justify-center gap-1.5 text-[12px] text-neutral-400">
              <Lock className="size-3.5 text-[#faab14]" aria-hidden="true" />
              <span>{allRightsReserved}</span>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
