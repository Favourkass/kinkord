import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export interface SubscriptionChromeProps {
  /** black: the plans and transfer screens; ink: the proof screen (#09090B). */
  tone: "black" | "ink";
  /**
   * The gold glow: a corner of it on phones (46:5, 48:351), wide on desktop
   * (48:114), centred 360px into the content as on the 1440 frame.
   */
  glow: { phone: boolean; desktop: boolean };
  back: { label: string; icon: "arrow" | "chevron"; href?: string; onClick?: () => void };
  /** "Secure Payment" with its lock, top right. */
  secure?: string;
  /** Desktop content width: 1080 for the plans (2:2), 1200 for the payment screens. */
  width: "plans" | "payment";
  /** The screen ends in its own full-bleed footer on phones, so no padding under it. */
  footer?: boolean;
  children: ReactNode;
}

function BackIcon({ icon }: { icon: "arrow" | "chevron" }) {
  if (icon === "arrow") {
    return <Image src="/app/subscription/back-arrow.svg" alt="" width={22} height={22} />;
  }
  return (
    <>
      <Image
        src="/app/subscription/back-chevron-24.svg"
        alt=""
        width={24}
        height={24}
        className="lg:hidden"
      />
      <Image
        src="/app/subscription/back-chevron.svg"
        alt=""
        width={22}
        height={22}
        className="hidden lg:block"
      />
    </>
  );
}

/**
 * The page around every Silver screen: black, full bleed, no app chrome, a
 * back control top left. Status-bar room comes from the safe area, as the
 * frames' 71px top is the iPhone status bar plus 21px.
 */
export default function SubscriptionChrome({
  tone,
  glow,
  back,
  secure,
  width,
  footer = false,
  children,
}: SubscriptionChromeProps) {
  const backClass =
    "grid size-[32px] -ml-[5px] place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-kink-amber";
  return (
    <div
      className={`relative min-h-dvh overflow-x-clip text-sub-text ${
        tone === "black" ? "bg-sub-page" : "bg-sub-page-ink"
      }`}
    >
      {glow.phone ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 size-[260px] bg-[radial-gradient(260px_circle_at_100%_0%,rgba(245,184,61,0.32)_0%,rgba(245,184,61,0.06)_55%,rgba(245,184,61,0)_100%)] lg:hidden"
        />
      ) : null}
      {glow.desktop ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[960px] bg-[radial-gradient(620px_circle_at_calc(50%_-_240px)_0%,rgba(245,184,61,0.16)_0%,rgba(245,184,61,0.04)_50%,rgba(245,184,61,0)_100%)] lg:block"
        />
      ) : null}
      <div
        className={`relative mx-auto w-full px-[20px] pt-[calc(env(safe-area-inset-top)+16px)] lg:px-[40px] lg:pb-[56px] lg:pt-[24px] ${
          footer ? "pb-0" : "pb-[max(40px,env(safe-area-inset-bottom))]"
        } ${width === "plans" ? "lg:max-w-[1160px]" : "lg:max-w-[1280px]"}`}
      >
        <div className="flex h-[40px] items-center justify-between">
          {back.href ? (
            <Link href={back.href} aria-label={back.label} className={backClass}>
              <BackIcon icon={back.icon} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={back.onClick}
              aria-label={back.label}
              className={backClass}
            >
              <BackIcon icon={back.icon} />
            </button>
          )}
          {secure ? (
            <p className="flex items-center gap-[8px] text-[13px] font-bold text-sub-muted lg:h-[40px] lg:flex-row-reverse lg:rounded-[20px] lg:border lg:border-sub-pay-line lg:bg-sub-pay-card lg:px-[15px] lg:text-[14px]">
              {secure}
              <Image src="/app/subscription/lock.svg" alt="" width={16} height={16} />
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
