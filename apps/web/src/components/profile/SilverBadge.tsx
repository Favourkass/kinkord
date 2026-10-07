"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import SilverCheck from "@/components/app/SilverCheck";

export interface SilverBadgeLabels {
  title: string;
  body: string;
  /** "Silver since October 2026" */
  since: (when: string) => string;
  /** Where the panel leads: Silver for someone else's profile, managing it on your own. */
  cta: string;
}

export interface SilverBadgeProps {
  /** "October 2026", or null when unknown. */
  since: string | null;
  labels: SilverBadgeLabels;
  href: string;
  size?: number;
}

/**
 * The profile's Silver check, which explains itself when tapped, the way X's
 * check opens a note on what it means and since when.
 */
export default function SilverBadge({ since, labels, href, size = 20 }: SilverBadgeProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex self-center">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-kink-amber"
      >
        <SilverCheck size={size} />
      </button>
      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={labels.title}
          className="absolute left-1/2 top-full z-30 mt-[10px] block w-[264px] -translate-x-1/2 rounded-[16px] border border-pf-border bg-pf-surface p-[14px] text-left font-normal leading-normal whitespace-normal shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        >
          <span className="flex items-center gap-[8px] text-[15px] font-bold text-pf-text">
            <SilverCheck size={18} />
            {labels.title}
          </span>
          <span className="mt-[6px] block text-[13px] leading-[18px] text-pf-muted">
            {labels.body}
          </span>
          {since ? (
            <span className="mt-[6px] block text-[12px] font-bold text-pf-muted">
              {labels.since(since)}
            </span>
          ) : null}
          <Link
            href={href}
            className="mt-[12px] flex h-[36px] items-center justify-center rounded-full bg-kink-amber text-[13px] font-bold text-black"
          >
            {labels.cta}
          </Link>
        </span>
      ) : null}
    </span>
  );
}
