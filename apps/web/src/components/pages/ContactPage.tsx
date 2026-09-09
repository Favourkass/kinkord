"use client";

import Link from "next/link";
import Image from "next/image";
import type { ContactVM, SupportTopicVM } from "@/presenters/useContactPresenter";

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

function ChevronRightIcon({ className = "text-neutral-500" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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

function MailIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.78 14.07c-.24.68-1.39 1.33-1.92 1.39-.49.06-1.12.09-3.26-.78-2.58-1.05-4.24-3.67-4.37-3.84-.13-.17-1.04-1.38-1.04-2.64 0-1.25.66-1.87.89-2.12.24-.25.52-.31.69-.31.18 0 .35.01.5.01.16 0 .38-.06.59.45.22.52.74 1.82.81 1.95.07.13.11.29.02.47-.09.17-.14.28-.27.44-.14.15-.29.34-.41.46-.14.13-.28.28-.12.56.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.59-.07.16-.18.69-.81.87-1.08.18-.28.37-.23.62-.14.25.09 1.58.74 1.85.88.27.13.45.2.52.31.06.12.06.7-.18 1.38z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function TwitterXIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function WarningTriangleIcon({ color = "#ffba1f" }: { color?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RedAlertIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
        fill="#e11d48"
      />
      <line x1="12" y1="9" x2="12" y2="13" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="#ffffff" />
    </svg>
  );
}

function ShieldLockIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="1.5" fill="#ffba1f" />
      <path d="M12 12.5v3" stroke="#ffba1f" strokeWidth="2" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function UserSquareIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 18a5 5 0 0 1 10 0" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" strokeWidth="2.5" />
      <line x1="6" x2="10" y1="14" y2="14" strokeWidth="2" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="12.01" strokeWidth="2.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2M13 11v2M13 17v2" strokeDasharray="2 2" />
    </svg>
  );
}

/* --- Navigation Icons for Sidebar & TabBar --- */

function HomeNavIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffba1f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ChatNavIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <circle cx="8" cy="12" r="0.8" fill="#ffffff" />
      <circle cx="12" cy="12" r="0.8" fill="#ffffff" />
      <circle cx="16" cy="12" r="0.8" fill="#ffffff" />
    </svg>
  );
}

function SettingsNavIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutNavIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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

/* --- Component View --- */

export default function ContactPage({
  brand,
  headline,
  lead,
  subcopy,
  getInTouchHeading,
  channels,
  office,
  safetyNotice,
  importantNotice,
  chooseTopicHeading,
  chooseTopicSubcopy,
  topics,
  drawerOpen,
  openDrawer,
  closeDrawer,
  navLinks,
  bottomNav,
  selectedTopic,
  selectTopic,
  handleTopicClick,
  onLogout,
  isLoggedIn,
  loginHref,
  signupHref,
}: ContactVM) {
  const renderChannelIcon = (icon: string) => {
    switch (icon) {
      case "email":
        return <MailIcon />;
      case "whatsapp":
        return <WhatsAppIcon />;
      case "phone":
        return <PhoneIcon />;
      case "twitter":
        return <TwitterXIcon />;
      default:
        return <MailIcon />;
    }
  };

  const renderTopicIcon = (topic: SupportTopicVM) => {
    if (topic.isAlert) {
      return <RedAlertIcon />;
    }
    switch (topic.icon) {
      case "headset":
        return <HeadsetIcon />;
      case "user":
        return <UserSquareIcon />;
      case "creditCard":
        return <CreditCardIcon />;
      case "briefcase":
        return <BriefcaseIcon />;
      case "ticket":
        return <TicketIcon />;
      default:
        return <HeadsetIcon />;
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white selection:bg-[#ffba1f] selection:text-black">
      {/* Desktop Left Sidebar (Only visible when user is logged in) */}
      {isLoggedIn && (
        <aside className="hidden w-[280px] shrink-0 sticky top-0 h-screen flex-col bg-[#1e1e1e] pt-[44px] pb-[44px] px-[36px] z-20 lg:flex">
          {/* Brand */}
          <Link
            href={bottomNav.homeHref}
            className="text-[34px] font-black tracking-[2px] text-[#ffba1f] transition-opacity hover:opacity-90 mb-[44px]"
          >
            {brand}
          </Link>

          {/* Navigation Items */}
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

          {/* Log Out Button */}
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
                    onLogout();
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
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 lg:px-14 lg:py-12">
        <div className="mx-auto w-full max-w-[880px]">
          {/* Top Header */}
          <header className={`flex items-center justify-between py-2 mb-6 ${isLoggedIn ? "lg:hidden" : ""}`}>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={openDrawer}
                className="flex items-center justify-center p-1 transition-transform active:scale-95"
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

          {/* Page Title & Intro */}
          <section className="mt-4 lg:mt-0 mb-6">
            <h1 className="text-center text-3xl sm:text-4xl lg:text-[42px] font-black tracking-wide text-white">
              {headline}
            </h1>
            <div className="mt-6 lg:mt-8">
              <h2 className="text-xl lg:text-[22px] font-bold text-[#ffba1f]">{lead}</h2>
              <p className="mt-1 text-sm lg:text-[15px] leading-relaxed text-neutral-400">{subcopy}</p>
            </div>
          </section>

          {/* GET IN TOUCH Section (1 col mobile, 2 cols desktop) */}
          <section className="mt-2 mb-6">
            <h3 className="mb-3 text-sm lg:text-[14px] font-bold tracking-wider text-[#ffba1f] uppercase">
              {getInTouchHeading}
            </h3>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {channels.map((channel) => (
                <a
                  key={channel.id}
                  href={channel.href}
                  target={channel.href.startsWith("http") ? "_blank" : undefined}
                  rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex items-center justify-between rounded-[16px] border border-[#222222] bg-[#121212] p-4 transition-all duration-200 hover:border-[#ffba1f]/40 hover:bg-[#161616]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-9 shrink-0 items-center justify-center">
                      {renderChannelIcon(channel.icon)}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-white group-hover:text-[#ffba1f] transition-colors">
                        {channel.title}
                      </p>
                      <p className="text-[13px] font-medium text-[#ffba1f] mt-0.5">{channel.value}</p>
                    </div>
                  </div>

                  <ChevronRightIcon className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </a>
              ))}
            </div>
          </section>

          {/* OUR OFFICE Card */}
          <section className="mb-3.5">
            <div className="flex items-start gap-4 rounded-[16px] border border-[#ffba1f]/25 bg-[#0e0e0e] p-4.5">
              <div className="mt-0.5 shrink-0">
                <MapPinIcon />
              </div>
              <div>
                <p className="text-[13px] font-bold tracking-wider text-white uppercase">{office.title}</p>
                <p className="mt-0.5 text-[14px] font-semibold text-white">{office.company}</p>
                <div className="mt-0.5 text-[13px] text-neutral-400">
                  {office.addressLines.join(", ")}
                </div>
              </div>
            </div>
          </section>

          {/* SAFETY NOTICE Card */}
          <section className="mb-3.5">
            <div className="flex items-start gap-4 rounded-[16px] border border-[#ffba1f]/35 bg-[#0e0e0e] p-4.5">
              <div className="mt-0.5 shrink-0">
                <WarningTriangleIcon />
              </div>
              <div>
                <p className="text-[13px] font-bold tracking-wider text-white uppercase">
                  {safetyNotice.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{safetyNotice.body}</p>
              </div>
            </div>
          </section>

          {/* IMPORTANT NOTICE Card */}
          <section className="mb-8">
            <div className="flex items-start gap-4 rounded-[16px] border border-[#ffba1f]/35 bg-[#0e0e0e] p-4.5">
              <div className="mt-0.5 shrink-0">
                <ShieldLockIcon />
              </div>
              <div>
                <p className="text-[13px] font-bold tracking-wider text-white uppercase">
                  {importantNotice.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                  {importantNotice.body}
                </p>
              </div>
            </div>
          </section>

          {/* CHOOSE A TOPIC Section (1 col mobile, 2 cols desktop) */}
          <section className="mb-6">
            <h3 className="text-xl lg:text-[20px] font-bold tracking-wide text-[#ffba1f] uppercase">
              {chooseTopicHeading}
            </h3>
            <p className="mt-1 mb-4 text-xs lg:text-[14px] text-neutral-400">{chooseTopicSubcopy}</p>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleTopicClick(topic)}
                  className="group flex w-full items-center justify-between rounded-[16px] border border-[#222222] bg-[#121212] p-4 text-left transition-all duration-200 hover:border-[#ffba1f]/40 hover:bg-[#161616]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-9 shrink-0 items-center justify-center">
                      {renderTopicIcon(topic)}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-white group-hover:text-[#ffba1f] transition-colors">
                        {topic.title}
                      </p>
                      <p className="text-[13px] text-neutral-400 mt-0.5">{topic.subtitle}</p>
                    </div>
                  </div>

                  <ChevronRightIcon className="text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </section>

          {/* Selected Topic Feedback Notice (if active) */}
          {selectedTopic && (
            <div
              className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-xl border border-[#ffba1f]/50 bg-[#141414] p-4 shadow-xl backdrop-blur-md"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#ffba1f]">Connecting to Support</p>
                  <p className="text-xs text-neutral-300 mt-1">
                    Drafting support inquiry for: <span className="font-semibold text-white">{selectedTopic.title}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectTopic(null)}
                  className="text-neutral-400 hover:text-white"
                  aria-label="Dismiss notice"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar (Visible on mobile/tablet, hidden on lg+) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800/80 bg-black/95 px-6 py-3.5 backdrop-blur-md lg:hidden"
        aria-label="Bottom Navigation"
      >
        <div className="mx-auto flex max-w-[480px] items-center justify-around">
          <Link
            href={bottomNav.homeHref}
            className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
            aria-label="Home"
          >
            <HomeNavIcon />
          </Link>
          <Link
            href={bottomNav.messagesHref}
            className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
            aria-label="Messages"
          >
            <ChatNavIcon />
          </Link>
          <Link
            href={bottomNav.settingsHref}
            className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
            aria-label="Settings"
          >
            <SettingsNavIcon />
          </Link>
          <Link
            href={bottomNav.profileHref}
            className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
            aria-label="Profile"
          >
            <ProfileAvatarIcon avatarUrl={bottomNav.avatarUrl} />
          </Link>
        </div>
      </nav>
    </div>
  );
}
