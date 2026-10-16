import Link from "next/link";
import MaskIcon from "./MaskIcon";

export interface AppMobileHeaderProps {
  brand: string;
  onMenu: () => void;
  menuLabel?: string;
  /** The app's search, at the right of the bar, as Facebook has it. */
  search?: { href: string; label: string };
}

/**
 * Compact post-login header (Figma 864:53 / 881:730): hamburger 35px + gold
 * wordmark 30px on one row, hairline underneath. Content starts 22px down and
 * the hairline sits at 79px, as drawn.
 */
export default function AppMobileHeader({
  brand,
  onMenu,
  menuLabel = "Open menu",
  search,
}: AppMobileHeaderProps) {
  return (
    <header className="flex h-[80px] shrink-0 items-center gap-2 border-b border-mem-hairline bg-mem-header px-[18px]">
      <button
        type="button"
        aria-label={menuLabel}
        onClick={onMenu}
        className="flex size-11 shrink-0 items-center justify-center text-mem-icon"
      >
        <MaskIcon name="hamburger" width={35} />
      </button>
      <p className="text-[30px] font-extrabold leading-none text-kink-gold-bright">{brand}</p>
      {search ? (
        <Link
          href={search.href}
          aria-label={search.label}
          className="ml-auto grid size-[40px] place-items-center rounded-full bg-mem-card text-mem-icon"
        >
          <MaskIcon name="search" width={22} />
        </Link>
      ) : null}
    </header>
  );
}
