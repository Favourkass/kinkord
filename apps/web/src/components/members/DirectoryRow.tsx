import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/app/icons";

export interface DirectoryRowProps {
  title: string;
  subtitle: string;
  leading?: ReactNode;
  /** Navigates when set; renders as a non-interactive row (e.g. "Coming Soon") when null. */
  href: string | null;
  /** Trailing pill instead of the chevron (used for unlaunched countries). */
  badge?: string | null;
}

/** Compact Facebook-style list row: leading glyph, title, subtitle, chevron or badge. */
export default function DirectoryRow({ title, subtitle, leading, href, badge }: DirectoryRowProps) {
  const body = (
    <>
      {leading !== undefined && (
        <span className="grid size-[40px] shrink-0 place-items-center text-[26px] leading-none">
          {leading}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-app-text">{title}</span>
        <span className="block truncate text-[13px] text-app-muted">{subtitle}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-kink-amber/60 px-[10px] py-[3px] text-[11px] font-bold uppercase tracking-[1px] text-kink-amber">
          {badge}
        </span>
      ) : (
        <ChevronRightIcon className="shrink-0 text-kink-amber" />
      )}
    </>
  );
  const className =
    "flex h-[64px] w-full items-center gap-[14px] rounded-[14px] border border-app-card-border bg-app-card px-[14px] text-left";
  if (!href) {
    return (
      <div className={`${className} opacity-80`} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={`${className} active:bg-app-members`}>
      {body}
    </Link>
  );
}
