import Link from "next/link";
import type { ReactNode } from "react";
import MaskIcon from "@/components/app/MaskIcon";

export interface EditRowItem {
  key: string;
  /** Figma-exported glyph path; painted gold through a CSS mask. */
  icon: string;
  title: string;
  subtitle: string;
  href?: string;
  onClick?: () => void;
}

export interface EditRowsCardProps {
  rows: EditRowItem[];
  /**
   * "list": one card, hairline-divided rows (hub + Basic/Kinks/Location, Figma 1542:362).
   * "cards": a card per row with a bigger plate (Privacy & Socials, Figma 1642:39).
   */
  variant?: "list" | "cards";
}

function RowShell({
  row,
  className,
  children,
}: {
  row: EditRowItem;
  className: string;
  children: ReactNode;
}) {
  if (row.href) {
    return (
      <Link href={row.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={row.onClick} className={className}>
      {children}
    </button>
  );
}

export default function EditRowsCard({ rows, variant = "list" }: EditRowsCardProps) {
  if (variant === "cards") {
    return (
      <div className="flex w-full flex-col gap-[12px]">
        {rows.map((row) => (
          <RowShell
            key={row.key}
            row={row}
            className="flex w-full items-center gap-[16px] rounded-[20px] border border-pf-border bg-pf-card p-[16px] text-left"
          >
            <span className="grid size-[48px] shrink-0 place-items-center rounded-[14px] bg-pf-plate text-kink-gold-bright">
              <MaskIcon src={row.icon} width={24} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
              <span className="text-[16px] font-semibold text-pf-text">{row.title}</span>
              <span className="truncate text-[14px] text-pf-muted-2">{row.subtitle}</span>
            </span>
            <MaskIcon
              src="/app/profile/edit/chevron-left-20.svg"
              width={20}
              className="rotate-180 text-kink-gold-bright"
            />
          </RowShell>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full rounded-[16px] border border-pf-border bg-pf-surface p-[16px]">
      {rows.map((row) => (
        <RowShell
          key={row.key}
          row={row}
          className="flex w-full items-center justify-between gap-[12px] border-b border-pf-divider py-[12px] text-left last:border-b-0"
        >
          <span className="flex min-w-0 items-center gap-[12px]">
            <span className="grid size-[40px] shrink-0 place-items-center rounded-[20px] bg-pf-plate text-kink-gold-bright">
              <MaskIcon src={row.icon} width={24} />
            </span>
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className="text-[13px] font-bold text-pf-text">{row.title}</span>
              <span className="line-clamp-2 text-[11px] text-pf-muted">{row.subtitle}</span>
            </span>
          </span>
          <span className="grid size-[32px] shrink-0 place-items-center">
            <MaskIcon
              src="/app/profile/icon-chevron-left-small.svg"
              width={16}
              className="rotate-180 text-kink-gold-bright"
            />
          </span>
        </RowShell>
      ))}
    </div>
  );
}
