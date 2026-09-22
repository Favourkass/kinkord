"use client";

import { useEffect, useRef } from "react";
import type { ChatRuleSection } from "@/domain/chatRules";

export interface ChatRulesGateProps {
  badge: string;
  title: string;
  intro: string;
  sections: readonly ChatRuleSection[];
  report: string;
  closing: string;
  acknowledgeLabel: string;
  neverLabel: string;
  neverShow: boolean;
  onNeverShowChange: (next: boolean) => void;
  onAcknowledge: () => void;
}

/**
 * Blocking gate before messaging. Same furniture as the app's other modals —
 * full-screen sheet on a phone, centred panel on a wide screen — but not
 * dismissible: no backdrop click, no Escape. The only way out is the button,
 * which is the point: this is the acknowledgment, not a notice.
 *
 * The list is the scroll region, so the header, the "By continuing…" line and
 * the footer stay pinned no matter how short the viewport is.
 */
export default function ChatRulesGate(p: ChatRulesGateProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lock the page behind the gate, and move focus onto the only control so a
  // keyboard or screen-reader user is not left reading the messages page.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-rules-title"
      aria-describedby="chat-rules-intro"
      className="fixed inset-0 z-[200] flex flex-col bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center sm:p-[24px]"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-feed-sheet sm:h-auto sm:max-h-[88dvh] sm:max-w-[560px] sm:rounded-[20px] sm:shadow-2xl">
        {/* Header — pinned. */}
        <header className="flex shrink-0 items-center gap-[12px] border-b border-feed-line px-[20px] py-[16px]">
          <span
            aria-hidden
            className="grid size-[36px] shrink-0 place-items-center rounded-full bg-kink-gold-bright/15 text-[20px] leading-none"
          >
            {p.badge}
          </span>
          <h2
            id="chat-rules-title"
            className="text-[15px] font-black uppercase leading-[18px] tracking-[0.6px] text-feed-text"
          >
            {p.title}
          </h2>
        </header>

        {/* Scroll region — the rules. */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[20px] py-[18px]"
        >
          <p id="chat-rules-intro" className="text-[13.5px] leading-[21px] text-feed-text">
            {p.intro}
          </p>

          {p.sections.map((section, i) => (
            <Section key={`${section.kind}-${i}`} section={section} />
          ))}

          {/* Report CTA — a soft, bordered callout so it reads as a next step,
              not another rule. */}
          <div className="mt-[18px] rounded-[12px] border border-kink-gold-bright/30 bg-kink-gold-bright/5 p-[14px]">
            <p className="text-[12.5px] leading-[19px] text-feed-text">{p.report}</p>
          </div>

          <p className="pt-[18px] text-[12px] italic leading-[18px] text-feed-muted">{p.closing}</p>
        </div>

        {/* Footer — pinned. */}
        <footer className="shrink-0 border-t border-feed-line bg-feed-sheet px-[20px] py-[14px] pb-[calc(14px+env(safe-area-inset-bottom))] sm:pb-[16px]">
          <label className="flex cursor-pointer select-none items-center gap-[10px] pb-[12px]">
            <input
              type="checkbox"
              checked={p.neverShow}
              onChange={(e) => p.onNeverShowChange(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`grid size-[20px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-kink-gold-bright/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-feed-sheet ${
                p.neverShow
                  ? "border-kink-gold-bright bg-kink-gold-bright"
                  : "border-feed-line bg-transparent"
              }`}
            >
              {p.neverShow && (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2.5 6.2l2.4 2.3L9.5 3.8"
                    fill="none"
                    stroke="#0a0a0a"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="text-[13px] font-medium text-feed-text">{p.neverLabel}</span>
          </label>

          <button
            ref={buttonRef}
            type="button"
            onClick={p.onAcknowledge}
            className="h-[46px] w-full rounded-[12px] bg-kink-gold-bright text-[14px] font-bold text-kink-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kink-gold-bright/60 focus-visible:ring-offset-2 focus-visible:ring-offset-feed-sheet active:opacity-80"
          >
            {p.acknowledgeLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({ section }: { section: ChatRuleSection }) {
  if (section.kind === "plain") {
    return (
      <section className="pt-[18px]">
        <h3 className="text-[13.5px] font-bold leading-[20px] text-feed-text">{section.title}</h3>
        {section.lead && (
          <p className="pt-[6px] text-[13px] leading-[20px] text-feed-text">{section.lead}</p>
        )}
        {section.bullets && (
          <ul className="flex flex-col gap-[8px] pt-[8px]">
            {section.bullets.map((b) => (
              <li key={b} className="flex gap-[10px]">
                <span
                  aria-hidden
                  className="mt-[8px] block size-[4px] shrink-0 rounded-full bg-kink-gold-bright"
                />
                <span className="text-[13px] leading-[20px] text-feed-text">{b}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Gift and warning both render as a titled block; the warning leans on the
  // app's own accent so "this one is different" reads at a glance.
  const warning = section.kind === "warning";
  return (
    <section
      className={`mt-[18px] rounded-[12px] border p-[14px] ${
        warning
          ? "border-kink-gold-bright/40 bg-kink-gold-bright/5"
          : "border-feed-line bg-feed-field"
      }`}
    >
      <h3 className="flex items-center gap-[8px] text-[13px] font-black uppercase leading-[18px] tracking-[0.5px] text-feed-text">
        {section.icon && (
          <span aria-hidden className="text-[15px] leading-none">
            {section.icon}
          </span>
        )}
        {section.title}
      </h3>
      {section.paragraphs && (
        <div className="flex flex-col gap-[8px] pt-[8px]">
          {section.paragraphs.map((para) => (
            <p key={para} className="text-[12.5px] leading-[19px] text-feed-text">
              {para}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
