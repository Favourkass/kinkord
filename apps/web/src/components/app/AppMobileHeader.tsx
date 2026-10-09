import Link from "next/link";
import MaskIcon from "./MaskIcon";

export interface AppMobileHeaderProps {
  brand: string;
  onMenu: () => void;
  menuLabel?: string;
  searchHref?: string;
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
  searchHref,
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
      <p className="min-w-0 text-[30px] font-extrabold leading-none text-kink-gold-bright">
        {brand}
      </p>
      {searchHref && (
        <Link
          href={searchHref}
          aria-label="Search"
          className="ml-auto flex size-11 shrink-0 items-center justify-center text-kink-gold-bright"
        >
          <MaskIcon name="search" width={28} />
        </Link>
      )}
    </header>
  );
}
