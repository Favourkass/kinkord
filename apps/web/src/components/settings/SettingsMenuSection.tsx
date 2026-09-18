import type { ReactNode } from "react";
import { ChevronRightSmall } from "./icons";

export interface SettingsMenuItem {
  id: string;
  title: string;
  icon: ReactNode;
  onClick?: () => void;
}

export interface SettingsMenuSectionProps {
  title: string;
  items: SettingsMenuItem[];
}

export default function SettingsMenuSection({ title, items }: SettingsMenuSectionProps) {
  return (
    <div className="w-full">
      <p className="pt-[24px] pb-[6px] text-[13px] font-semibold text-zinc-400 dark:text-zinc-400 text-zinc-500">
        {title}
      </p>
      <div className="flex flex-col">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="group flex h-[48px] w-full items-center justify-between border-b border-zinc-800/60 dark:border-zinc-800/60 border-zinc-200/70 px-1 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.08] cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <span className="shrink-0 text-amber-500">{item.icon}</span>
              <span className="text-[15px] font-normal text-white dark:text-white text-zinc-900 group-hover:text-amber-400 dark:group-hover:text-amber-400 transition-colors">
                {item.title}
              </span>
            </div>
            <ChevronRightSmall className="size-4 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
