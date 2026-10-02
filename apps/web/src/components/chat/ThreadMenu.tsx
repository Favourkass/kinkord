"use client";

import MaskIcon from "@/components/app/MaskIcon";

export interface ThreadMenuItem {
  key: "report" | "block" | "unblock";
  label: string;
  danger: boolean;
}

export interface ThreadMenuProps {
  open: boolean;
  label: string;
  items: ThreadMenuItem[];
  onToggle: () => void;
  onClose: () => void;
  onSelect: (key: ThreadMenuItem["key"]) => void;
}

/** The ⋯ in a thread's header: report or block the other member. */
export default function ThreadMenu(p: ThreadMenuProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={p.onToggle}
        aria-label={p.label}
        aria-haspopup="menu"
        aria-expanded={p.open}
        className="grid size-[36px] place-items-center rounded-full text-app-text hover:bg-app-input"
      >
        <MaskIcon src="/app/feed/icon-dots.svg" width={20} />
      </button>
      {p.open && (
        <>
          {/* A tap anywhere else closes it. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={p.onClose}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-[40px] z-20 min-w-[180px] overflow-hidden rounded-[12px] border border-app-line bg-app-surface shadow-lg"
          >
            {p.items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => p.onSelect(item.key)}
                className={`block w-full px-[16px] py-[12px] text-left text-[14px] font-medium hover:bg-app-input ${
                  item.danger ? "text-app-danger" : "text-app-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
