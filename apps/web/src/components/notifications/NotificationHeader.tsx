import { Menu, Search } from "lucide-react";

export interface NotificationHeaderProps {
  title: string;
  searchLabel: string;
  searchOpen: boolean;
  onMenu: () => void;
  onSearch: () => void;
}

export default function NotificationHeader(p: NotificationHeaderProps) {
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-[15px] bg-app-surface px-4 text-app-text">
      <button
        type="button"
        aria-label="Open menu"
        onClick={p.onMenu}
        className="grid size-7 shrink-0 place-items-center"
      >
        <Menu size={25} strokeWidth={2} />
      </button>
      <h1 className="min-w-0 flex-1 text-[20px] font-bold leading-none tracking-[0.01em] text-kink-gold-bright min-[420px]:text-[22px]">
        {p.title}
      </h1>
      <button
        type="button"
        aria-label={p.searchLabel}
        aria-expanded={p.searchOpen}
        onClick={p.onSearch}
        className="grid size-8 shrink-0 place-items-center text-kink-gold-bright"
      >
        <Search size={25} strokeWidth={2.3} />
      </button>
    </header>
  );
}
