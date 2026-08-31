import { HamburgerIcon } from "./icons";

export interface AppMobileHeaderProps {
  brand: string;
  tagline: string;
  greeting: string;
  onMenu: () => void;
}

/** Mobile top bar: hamburger, gold wordmark, tagline, greeting row, hairline. */
export default function AppMobileHeader({
  brand,
  tagline,
  greeting,
  onMenu,
}: AppMobileHeaderProps) {
  return (
    <header className="relative border-b border-app-line bg-app-surface pb-[9px]">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="absolute left-[15px] top-[29px] text-app-text"
      >
        <HamburgerIcon />
      </button>
      <p className="pt-[23px] text-center text-[48px] font-extrabold leading-none tracking-[4.8px] text-kink-amber">
        {brand}
      </p>
      <p className="text-center text-[10px] font-semibold tracking-[2px] text-app-text">
        {tagline}
      </p>
      <p className="pl-[15px] pt-[8px] text-[12px] font-normal text-app-text">
        {greeting} <span aria-hidden>🤗</span>
      </p>
    </header>
  );
}
