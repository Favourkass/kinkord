import { useRef, type KeyboardEvent } from "react";
import type { FeedTab, FeedTabVM } from "@/domain/post";

export interface FeedTabsProps {
  /** Names the tab list for screen readers. */
  label: string;
  tabs: FeedTabVM[];
  onSelect: (tab: FeedTab) => void;
  /** The element the tabs control: the list of posts below them. */
  panelId: string;
}

/** The id a tab's button carries, for the panel's `aria-labelledby`. */
export const feedTabId = (tab: FeedTab) => `feed-tab-${tab}`;

/** Arrow keys walk the tabs (wrapping), Home and End jump to the ends. */
const STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/**
 * For You | Following | Nearby at the top of the home feed: one underlined
 * row, the selected tab in gold, as on a profile's tabs. A WAI-ARIA tab list
 * with automatic activation: only the selected tab is in the Tab order, and
 * the arrow keys move the selection and the focus together.
 */
export default function FeedTabs({ label, tabs, onSelect, panelId }: FeedTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = step(index, tabs.length);
    buttons.current[next]?.focus();
    onSelect(tabs[next].value);
  };

  return (
    <div role="tablist" aria-label={label} className="flex border-b border-feed-line">
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          id={feedTabId(tab.value)}
          type="button"
          role="tab"
          aria-selected={tab.selected}
          aria-controls={panelId}
          tabIndex={tab.selected ? 0 : -1}
          onClick={() => onSelect(tab.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={`-mb-px h-[48px] flex-1 border-b-2 px-[8px] text-[15px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kink-gold-bright ${
            tab.selected
              ? "border-kink-gold-bright font-bold text-kink-gold-bright"
              : "border-transparent font-medium text-feed-muted hover:text-feed-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
