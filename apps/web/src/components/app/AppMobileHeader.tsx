import MaskIcon from "./MaskIcon";

export interface AppMobileHeaderProps {
  brand: string;
  onMenu: () => void;
  menuLabel?: string;
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
}: AppMobileHeaderProps) {
  return (
    <header className="flex h-[80px] shrink-0 items-center gap-[12px] border-b border-mem-hairline bg-mem-header px-[18px] pb-[22px] pt-[22px]">
      <button type="button" aria-label={menuLabel} onClick={onMenu} className="text-mem-icon">
        <MaskIcon name="hamburger" width={35} />
      </button>
      <p className="text-[30px] font-extrabold leading-none text-kink-gold-bright">{brand}</p>
    </header>
  );
}
