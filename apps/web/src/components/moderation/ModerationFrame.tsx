import Link from "next/link";
import type { ReactNode } from "react";

export interface ModerationTab {
  label: string;
  href: string;
  active: boolean;
}

export interface ModerationFrameProps {
  title: string;
  tabs: ModerationTab[];
  checking: boolean;
  isAdmin: boolean;
  checkingLabel: string;
  deniedLabel: string;
  children: ReactNode;
}

/** Heading, tabs and the access gate shared by every admin screen. */
export default function ModerationFrame({
  title,
  tabs,
  checking,
  isAdmin,
  checkingLabel,
  deniedLabel,
  children,
}: ModerationFrameProps) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-[16px] pb-[48px] md:px-[29px]">
      <h1 className="text-[24px] font-medium text-app-value">{title}</h1>
      {checking ? (
        <p className="pt-[24px] text-[15px] text-app-subtle">{checkingLabel}</p>
      ) : !isAdmin ? (
        <p className="pt-[24px] text-[15px] text-app-subtle">{deniedLabel}</p>
      ) : (
        <>
          <nav
            className="-mx-[16px] flex gap-[8px] overflow-x-auto px-[16px] pt-[16px] [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
            aria-label={title}
          >
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full px-[16px] py-[8px] text-[14px] font-bold ${
                  t.active
                    ? "bg-kink-amber text-black"
                    : "border border-app-input-border bg-app-input text-app-value"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="pt-[20px]">{children}</div>
        </>
      )}
    </div>
  );
}
