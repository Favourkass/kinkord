import Link from "next/link";
import type { ReactNode } from "react";
import { BackChevronIcon } from "@/components/app/icons";

export interface DirectoryHeaderVM {
  brand: string;
  tagline: string;
  backHref: string;
  backLabel: string;
}

export interface DirectoryPageProps {
  header: DirectoryHeaderVM;
  children: ReactNode;
}

/**
 * Chrome for the Members directory (country → state → kinksters), per the CEO
 * brief: back button, KINKORD wordmark + tagline, gold divider — and deliberately
 * no bottom navigation.
 */
export default function DirectoryPage({ header, children }: DirectoryPageProps) {
  return (
    <div className="min-h-dvh bg-app-surface text-app-text">
      <header className="relative border-b-2 border-kink-amber/70 bg-app-surface pb-[10px]">
        <Link
          href={header.backHref}
          aria-label={header.backLabel}
          className="absolute left-[8px] top-[22px] text-app-text"
        >
          <BackChevronIcon />
        </Link>
        <p className="pt-[22px] text-center text-[40px] font-extrabold leading-none tracking-[4.8px] text-kink-amber">
          {header.brand}
        </p>
        <p className="pt-[2px] text-center text-[10px] font-semibold tracking-[2px] text-app-text">
          {header.tagline}
        </p>
      </header>
      <main className="mx-auto w-full max-w-[600px] px-[16px] pb-[48px] pt-[18px]">{children}</main>
    </div>
  );
}
