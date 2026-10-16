import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PlanPeriod } from "@/domain/subscription";

const icon = (name: string) => `/app/subscription/${name}.svg`;

/** A gold icon in its tile, a title and a line under it (46:52, 46:174). */
export function SectionHeading({
  iconName,
  title,
  body,
  bodyClassName = "",
  aside,
}: {
  iconName: string;
  title: string;
  body: string;
  bodyClassName?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-[12px] lg:gap-[16px]">
      <span className="grid size-[40px] shrink-0 place-items-center rounded-[12px] border border-sub-pay-gold-line bg-sub-pay-gold lg:size-[44px]">
        <Image
          src={icon(iconName)}
          alt=""
          width={22}
          height={22}
          className="size-[20px] lg:size-[22px]"
        />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-bold leading-[23px] text-sub-text-bright lg:text-[20px] lg:leading-[27px]">
          {title}
        </h2>
        <p
          className={`mt-[6px] text-[13px] leading-[20px] text-sub-muted lg:mt-[6px] lg:text-[14px] lg:leading-[22px] ${bodyClassName}`}
        >
          {body}
        </p>
      </div>
      {aside}
    </div>
  );
}

/** The gold-outlined Copy pill (46:69, 46:190). */
export function CopyButton({
  label,
  onCopy,
  describedBy,
}: {
  label: string;
  onCopy: () => void;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-describedby={describedBy}
      aria-live="polite"
      className="flex h-[36px] shrink-0 items-center gap-[6px] rounded-[18px] border border-sub-pay-gold-line bg-sub-pay-gold pl-[13px] pr-[14px] text-[13px] font-bold text-kink-amber lg:h-[40px] lg:gap-[8px] lg:rounded-[20px] lg:pl-[16px] lg:pr-[17px] lg:text-[14px]"
    >
      <Image src={icon("copy")} alt="" width={16} height={16} />
      {label}
    </button>
  );
}

export interface PlanChoiceVM {
  period: PlanPeriod;
  label: string;
  price: string;
  per: string;
  approx: string;
  save: string | null;
  selected: boolean;
}

/** Monthly / Yearly on the transfer screen (46:37, 46:158): picking the other starts that payment. */
export function PlanChoices({
  plans,
  onSelect,
  disabled,
}: {
  plans: PlanChoiceVM[];
  onSelect: (period: PlanPeriod) => void;
  disabled: boolean;
}) {
  return (
    <div role="radiogroup" className="flex gap-[13px] lg:gap-[16px]">
      {plans.map((p) => (
        <button
          key={p.period}
          type="button"
          role="radio"
          aria-checked={p.selected}
          disabled={disabled && !p.selected}
          onClick={() => onSelect(p.period)}
          className={`relative flex h-[117px] flex-1 flex-col rounded-[20px] border px-[16px] pt-[16px] text-left disabled:opacity-60 lg:h-[141px] lg:px-[20px] lg:pt-[21px] ${
            p.selected ? "border-kink-amber bg-sub-pay-gold" : "border-sub-pay-line bg-sub-pay-card"
          }`}
        >
          {p.save ? (
            <span className="absolute -top-[11px] right-[12px] flex h-[25px] items-center rounded-[12px] bg-kink-amber pl-[10px] pr-[13px] text-[12px] font-bold text-sub-on-gold-deep lg:-top-[12px] lg:right-[16px] lg:pl-[12px] lg:pr-[15px]">
              {p.save}
            </span>
          ) : null}
          <span className="flex items-center gap-[7px] lg:gap-[9px]">
            {p.selected ? (
              <span className="grid size-[20px] shrink-0 place-items-center rounded-full border border-kink-amber">
                <span className="size-[10px] rounded-full bg-kink-amber" />
              </span>
            ) : (
              <span className="size-[20px] shrink-0 rounded-full border border-sub-pay-radio" />
            )}
            <span className="text-[15px] font-bold text-sub-text-bright lg:text-[16px]">
              {p.label}
            </span>
          </span>
          <span className="mt-[9px] flex items-baseline gap-[4px] lg:mt-[12px] lg:gap-[5px]">
            <span className="font-sora text-[24px] font-bold leading-[30px] text-sub-text-bright lg:text-[32px] lg:leading-[40px]">
              {p.price}
            </span>
            <span className="text-[13px] text-sub-muted lg:text-[14px]">{p.per}</span>
          </span>
          <span className="mt-[4px] block text-[13px] text-sub-muted lg:mt-[6px] lg:text-[14px]">
            {p.approx}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Where a payment stands, in the card style of the secure-handling note (48:462). */
export function PaymentNotice({
  tone = "info",
  title,
  body,
  children,
}: {
  tone?: "info" | "success" | "problem";
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "problem" ? "alert" : "status"}
      className="rounded-[16px] border border-sub-pay-line bg-sub-pay-card px-[16px] py-[17px] lg:px-[20px]"
    >
      <div className="flex gap-[12px]">
        <Image
          src={icon(tone === "success" ? "shield-check-solid" : "shield-check")}
          alt=""
          width={20}
          height={20}
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-[20px] text-sub-text-bright">{title}</p>
          <p className="mt-[3px] text-[13px] leading-[18px] text-sub-muted">{body}</p>
        </div>
      </div>
      {children ? <div className="mt-[16px] flex flex-col gap-[10px]">{children}</div> : null}
    </div>
  );
}

/** The big gold action (46:416, 46:602, 48:770). */
export function GoldButton({
  label,
  onClick,
  disabled,
  arrow,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** The desktop frames end the label with an arrow. */
  arrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[56px] w-full items-center justify-center gap-[5px] rounded-[16px] bg-kink-amber text-[17px] font-bold text-sub-on-gold-deep disabled:opacity-50 lg:h-[61px] lg:rounded-[21px] lg:gap-[15px]"
    >
      {label}
      {arrow ? (
        <Image
          src={icon("arrow-right")}
          alt=""
          width={20}
          height={20}
          className="hidden lg:block"
        />
      ) : null}
    </button>
  );
}

/** A quieter way out, outlined like Remove on the proof screen (48:433). */
export function OutlineLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex h-[44px] items-center justify-center rounded-[22px] border border-sub-pay-radio text-[15px] font-bold text-sub-text-bright lg:h-[48px] lg:rounded-[24px]"
    >
      {label}
    </Link>
  );
}

export function OutlineButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[44px] w-full items-center justify-center rounded-[22px] border border-sub-pay-radio text-[15px] font-bold text-sub-text-bright disabled:opacity-50 lg:h-[48px] lg:rounded-[24px]"
    >
      {label}
    </button>
  );
}

/** The octagon Silver medal of the payment screens (46:30, 46:151). */
export function SilverOctagon({
  alt,
  phone,
  desktop,
}: {
  alt: string;
  phone: [number, number];
  desktop: [number, number];
}) {
  return (
    <>
      <Image
        src={icon("medal-silver-octagon")}
        alt={alt}
        width={phone[0]}
        height={phone[1]}
        className="shrink-0 lg:hidden"
        style={{ width: phone[0], height: phone[1] }}
      />
      <Image
        src={icon("medal-silver-octagon")}
        alt=""
        width={desktop[0]}
        height={desktop[1]}
        className="hidden shrink-0 lg:block"
        style={{ width: desktop[0], height: desktop[1] }}
      />
    </>
  );
}
