import Image from "next/image";
import type { PlanPeriod } from "@/domain/subscription";
import {
  CopyButton,
  GoldButton,
  OutlineButton,
  OutlineLink,
  PaymentNotice,
  PlanChoices,
  SectionHeading,
  SilverOctagon,
  type PlanChoiceVM,
} from "./PaymentBits";

interface CopyAction {
  label: string;
  onCopy: () => void;
}

export interface BankTransferViewProps {
  copy: {
    title: readonly string[];
    subtitle: string;
    medalAlt: string;
    amountTitle: string;
    amountBody: string;
    expiresIn: string;
    uniqueTitle: string;
    uniqueBody: string;
    bankTitle: string;
    bankBody: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    referenceTitle: string;
    referenceBody: string;
    confirm: string;
    cta: string;
    expired: { title: string; body: string; restart: string; paid: string };
    back: string;
  };
  /** pay: counting down. expired: time's up, proof still taken. Anything else: `notice`. */
  view: "pay" | "expired" | "submitted" | "verified" | "rejected" | "lapsed";
  plans: PlanChoiceVM[];
  onSelectPlan: (period: PlanPeriod) => void;
  switching: boolean;
  countdown: string;
  amount: { value: string; usd: string; copyLabel: string; onCopy: () => void };
  bank: {
    badge: { text: string; colour: string };
    name: string;
    accountName: string;
    accountNumber: string;
    copyAccountName: CopyAction;
    copyAccountNumber: CopyAction;
  };
  reference: { value: string; copyLabel: string; onCopy: () => void };
  notice: { tone: "info" | "success" | "problem"; title: string; body: string } | null;
  confirmed: boolean;
  onToggleConfirmed: () => void;
  canContinue: boolean;
  onContinue: () => void;
  onRestart: () => void;
  subscriptionHref: string;
  error: string | null;
}

const icon = (name: string) => `/app/subscription/${name}.svg`;

function UniqueNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-[12px] lg:gap-[10px]">
      <Image src={icon("shield-check-solid")} alt="" width={20} height={20} className="shrink-0" />
      <div>
        <p className="text-[13px] font-bold leading-[18px] text-sub-text-bright lg:text-[14px] lg:leading-[19px]">
          {title}
        </p>
        <p className="mt-px text-[12px] leading-[16px] text-sub-muted lg:mt-[2px] lg:text-[13px] lg:leading-[18px]">
          {body}
        </p>
      </div>
    </div>
  );
}

/** Get Silver Premium by bank transfer: phone (Figma 46:2) and desktop (46:135). */
export default function BankTransferView(p: BankTransferViewProps) {
  const { copy } = p;
  const takesProof = p.view === "pay" || p.view === "expired";
  const clock = (
    <span className="flex items-center gap-[8px] text-[13px] font-bold text-sub-muted lg:gap-[6px]">
      <Image
        src={icon("clock")}
        alt=""
        width={18}
        height={18}
        className="size-[18px] lg:size-[16px]"
      />
      {copy.expiresIn}
    </span>
  );
  const countdown = (
    <span
      role="timer"
      aria-live="off"
      className="font-sora text-[17px] font-bold leading-[1.26] text-kink-amber lg:text-[20px]"
    >
      {p.countdown}
    </span>
  );

  return (
    <div className="mt-[11px] lg:mt-[49px] lg:grid lg:grid-cols-[539fr_595fr] lg:items-start lg:gap-[65px]">
      <div className="lg:pt-[23px]">
        <div className="flex items-center pl-[9px] lg:gap-[62px] lg:pl-0">
          <div className="min-w-0 flex-1 lg:w-[342px] lg:flex-none">
            <h1 className="w-[185px] font-sora text-[34px] font-bold leading-[31px] text-sub-text-bright lg:w-full lg:text-[56px] lg:leading-[52px]">
              {copy.title[0]}
              <span className="text-kink-amber">{copy.title[1]}</span>
            </h1>
            <p className="mt-[14px] text-[15px] leading-[20.5px] text-sub-muted lg:mt-[13px] lg:text-[17px] lg:leading-[23px]">
              {copy.subtitle}
            </p>
          </div>
          <SilverOctagon alt={copy.medalAlt} phone={[96, 104]} desktop={[136, 148]} />
        </div>

        <div className="mt-[48px] lg:mt-[49px]">
          <PlanChoices
            plans={p.plans}
            onSelect={p.onSelectPlan}
            disabled={p.switching || !takesProof}
          />
        </div>

        <section className="mt-[33px] lg:mt-[42px] lg:rounded-[24px] lg:border lg:border-sub-pay-line lg:bg-sub-pay-card lg:px-[27px] lg:pb-[29px] lg:pt-[28px]">
          <SectionHeading
            iconName="coins"
            title={copy.amountTitle}
            body={copy.amountBody}
            bodyClassName="lg:max-w-[220px]"
            aside={
              <div className="hidden flex-col items-end gap-[1px] lg:flex">
                {clock}
                {countdown}
              </div>
            }
          />
          <div className="mt-[14px] flex h-[47px] items-center justify-between rounded-[14px] border border-sub-pay-line bg-sub-pay-field pl-[16px] pr-[13px] lg:hidden">
            {clock}
            {countdown}
          </div>

          <div className="mt-[14px] rounded-[20px] border border-kink-amber bg-sub-pay-gold px-[19px] pb-[21px] pt-[17px] lg:mt-[22px] lg:px-[24px] lg:pb-[21px] lg:pt-[21px]">
            <div className="flex items-center justify-between gap-[12px]">
              <div className="min-w-0">
                <p className="font-sora text-[40px] font-bold leading-[50px] text-kink-amber lg:text-[48px] lg:leading-[60px]">
                  {p.amount.value}
                </p>
                <p className="mt-[5px] text-[13px] text-sub-muted lg:mt-[4px] lg:text-[14px]">
                  {p.amount.usd}
                </p>
              </div>
              <CopyButton label={p.amount.copyLabel} onCopy={p.amount.onCopy} />
            </div>
            <div className="lg:hidden">
              <div className="mt-[15px] h-px bg-sub-pay-gold-line" />
              <div className="mt-[16px]">
                <UniqueNote title={copy.uniqueTitle} body={copy.uniqueBody} />
              </div>
            </div>
          </div>
          <div className="mt-[17px] hidden lg:block">
            <UniqueNote title={copy.uniqueTitle} body={copy.uniqueBody} />
          </div>
        </section>
      </div>

      <section className="mt-[24px] border-t border-sub-pay-line pt-[24px] lg:mt-0 lg:rounded-[28px] lg:border lg:bg-sub-pay-card lg:px-[32px] lg:pb-[31px] lg:pt-[32px]">
        <SectionHeading iconName="bank" title={copy.bankTitle} body={copy.bankBody} />

        <div className="mt-[16px] rounded-[20px] border border-sub-pay-line bg-sub-pay-field lg:mt-[22px]">
          <div className="flex items-center gap-[12px] px-[15px] pb-[16px] pt-[16px] lg:gap-[16px] lg:px-[24px] lg:pb-[19px] lg:pt-[21px]">
            <span
              aria-hidden
              className="grid size-[44px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-white lg:size-[48px] lg:text-[13px]"
              style={{ backgroundColor: p.bank.badge.colour }}
            >
              {p.bank.badge.text}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] text-sub-muted lg:text-[14px]">{copy.bankName}</p>
              <p className="mt-[4px] truncate text-[17px] font-bold text-sub-text-bright lg:mt-[6px] lg:text-[18px]">
                {p.bank.name}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-[12px] border-t border-sub-pay-line px-[15px] pb-[16px] pt-[17px] lg:px-[24px] lg:pb-[19px] lg:pt-[21px]">
            <div className="min-w-0">
              <p className="text-[13px] text-sub-muted lg:text-[14px]">{copy.accountName}</p>
              <p className="mt-[4px] break-words text-[17px] font-bold text-sub-text-bright lg:mt-[6px] lg:text-[18px]">
                {p.bank.accountName}
              </p>
            </div>
            <CopyButton
              label={p.bank.copyAccountName.label}
              onCopy={p.bank.copyAccountName.onCopy}
            />
          </div>
          <div className="flex items-center justify-between gap-[12px] border-t border-sub-pay-line px-[15px] pb-[18px] pt-[17px] lg:px-[24px] lg:pb-[21px] lg:pt-[21px]">
            <div className="min-w-0">
              <p className="text-[13px] text-sub-muted lg:text-[14px]">{copy.accountNumber}</p>
              <p className="mt-[2px] font-sora text-[20px] font-bold leading-[1.26] text-sub-text-bright lg:mt-[4px] lg:text-[24px]">
                {p.bank.accountNumber}
              </p>
            </div>
            <CopyButton
              label={p.bank.copyAccountNumber.label}
              onCopy={p.bank.copyAccountNumber.onCopy}
            />
          </div>
        </div>

        <div className="mt-[12px] rounded-[20px] border border-sub-pay-line bg-sub-pay-field px-[15px] pb-[14px] pt-[16px] lg:mt-[17px] lg:px-[24px] lg:pb-[19px] lg:pt-[21px]">
          <p className="flex items-center gap-[8px] text-[13px] text-sub-muted lg:text-[14px]">
            <Image src={icon("tag")} alt="" width={18} height={18} />
            {copy.referenceTitle}
          </p>
          <div className="mt-[8px] flex items-center justify-between gap-[12px]">
            <p className="min-w-0 break-all font-sora text-[20px] font-bold leading-[1.26] text-sub-text-bright lg:text-[24px]">
              {p.reference.value}
            </p>
            <span className="-mr-[5px] lg:mr-0">
              <CopyButton label={p.reference.copyLabel} onCopy={p.reference.onCopy} />
            </span>
          </div>
          <div className="mt-[12px] h-px bg-sub-pay-line lg:mt-[15px]" />
          <p className="mt-[13px] text-[12px] leading-[18px] text-sub-muted lg:mt-[18px] lg:text-[13px]">
            {copy.referenceBody}
          </p>
        </div>

        <div className="-mx-[20px] mt-[9px] bg-sub-page-ink px-[20px] pb-[max(24px,env(safe-area-inset-bottom))] pt-[19px] lg:mx-0 lg:mt-[25px] lg:border-t lg:border-sub-pay-line lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-[35px]">
          {p.error ? (
            <p role="alert" className="mb-[12px] text-[14px] text-sub-danger">
              {p.error}
            </p>
          ) : null}
          {p.view === "pay" ? (
            <>
              <button
                type="button"
                role="checkbox"
                aria-checked={p.confirmed}
                onClick={p.onToggleConfirmed}
                className="flex w-full items-start gap-[12px] text-left lg:items-center lg:gap-[13px]"
              >
                <span
                  className={`mt-[1px] grid size-[24px] shrink-0 place-items-center rounded-[7px] border lg:mt-0 lg:size-[23px] ${
                    p.confirmed
                      ? "border-kink-amber bg-kink-amber"
                      : "border-sub-pay-radio bg-transparent"
                  }`}
                >
                  {p.confirmed ? <Image src={icon("check")} alt="" width={14} height={14} /> : null}
                </span>
                <span className="text-[15px] leading-[20.5px] text-sub-text-bright">
                  {copy.confirm}
                </span>
              </button>
              <div className="mt-[14px] lg:mt-[27px]">
                <GoldButton
                  label={copy.cta}
                  onClick={p.onContinue}
                  disabled={!p.canContinue}
                  arrow
                />
              </div>
            </>
          ) : p.view === "expired" ? (
            <PaymentNotice tone="problem" title={copy.expired.title} body={copy.expired.body}>
              <GoldButton label={copy.expired.paid} onClick={p.onContinue} />
              <OutlineButton
                label={copy.expired.restart}
                onClick={p.onRestart}
                disabled={p.switching}
              />
            </PaymentNotice>
          ) : p.notice ? (
            <PaymentNotice tone={p.notice.tone} title={p.notice.title} body={p.notice.body}>
              <OutlineLink href={p.subscriptionHref} label={copy.back} />
            </PaymentNotice>
          ) : null}
        </div>
      </section>
    </div>
  );
}
