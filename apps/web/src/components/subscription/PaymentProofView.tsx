import Image from "next/image";
import type { ChangeEvent, ReactNode } from "react";
import {
  GoldButton,
  OutlineLink,
  PaymentNotice,
  SectionHeading,
  SilverOctagon,
} from "./PaymentBits";

interface Field {
  value: string;
  onChange: (value: string) => void;
}

export interface PaymentProofViewProps {
  copy: {
    title: readonly string[];
    subtitle: string;
    medalAlt: string;
    detailsTitle: string;
    detailsBody: string;
    referenceLabel: string;
    amountLabel: string;
    editable: string;
    uploadTitle: string;
    uploadBody: string;
    choose: string;
    replace: string;
    remove: string;
    uploading: string;
    receiptAlt: string;
    senderTitle: string;
    senderBody: string;
    senderBank: { label: string; placeholder: string };
    senderName: { label: string; placeholder: string };
    senderNumber: { label: string; placeholder: string };
    secureTitle: string;
    secureBody: string;
    cta: string;
    submitting: string;
    back: string;
  };
  /** form: still taking proof. Otherwise `notice` says where the payment stands. */
  view: "form" | "submitted" | "verified" | "rejected" | "lapsed";
  notice: { tone: "info" | "success" | "problem"; title: string; body: string } | null;
  subscriptionHref: string;
  reference: Field;
  amount: Field;
  bank: Field;
  name: Field;
  number: Field;
  receipt: { previewUrl: string; uploading: boolean } | null;
  onPickReceipt: (file: File) => void;
  onRemoveReceipt: () => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}

const icon = (name: string) => `/app/subscription/${name}.svg`;
const RECEIPT_INPUT = "payment-receipt-file";

/** A value shown big, typed over in place (48:727, 48:778). */
function EditableField({
  id,
  label,
  editable,
  field,
  prefix,
  inputMode,
}: {
  id: string;
  label: string;
  editable: string;
  field: Field;
  prefix?: string;
  inputMode?: "decimal" | "text";
}) {
  return (
    <div className="flex items-center gap-[12px] rounded-[16px] border border-sub-pay-line bg-sub-pay-field px-[16px] pb-[14px] pt-[13px] lg:px-[19px] lg:pb-[19px] lg:pt-[16px]">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[13px] text-sub-muted lg:text-[14px]">
          {label}
        </label>
        <div className="mt-[4px] flex items-center font-sora text-[18px] font-bold leading-[1.26] text-sub-text-bright lg:text-[24px]">
          {prefix ? <span aria-hidden>{prefix}</span> : null}
          <input
            id={id}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            inputMode={inputMode}
            autoComplete="off"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent font-sora font-bold text-sub-text-bright outline-none"
          />
        </div>
      </div>
      <label
        htmlFor={id}
        className="flex shrink-0 cursor-text items-center gap-[6px] text-[13px] font-bold text-sub-muted"
      >
        <Image src={icon("pencil-small")} alt="" width={14} height={14} />
        {editable}
      </label>
    </div>
  );
}

/** One of the sender's details, icon left (48:445, 48:199). */
function SenderField({
  id,
  iconName,
  label,
  placeholder,
  field,
  inputMode,
  autoComplete,
  className = "",
}: {
  id: string;
  iconName: string;
  label: string;
  placeholder: string;
  field: Field;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-[12px] rounded-[16px] border border-sub-pay-line bg-sub-pay-field px-[16px] pb-[12px] pt-[16px] lg:gap-[16px] lg:px-[19px] lg:py-[18px] ${className}`}
    >
      <Image
        src={icon(iconName)}
        alt=""
        width={22}
        height={22}
        className="size-[20px] shrink-0 lg:size-[22px]"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[13px] text-sub-muted lg:text-[14px]">
          {label}
        </label>
        <input
          id={id}
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="mt-[6px] w-full min-w-0 bg-transparent text-[16px] text-sub-text-bright outline-none placeholder:text-sub-placeholder lg:mt-[5px]"
        />
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-sub-pay-line" />;
}

/** Submit your payment proof: phone (Figma 48:348) and desktop (48:111). */
export default function PaymentProofView(p: PaymentProofViewProps) {
  const { copy } = p;
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) p.onPickReceipt(file);
  };

  const heading = (
    <div className="flex items-start justify-between gap-[10px] lg:justify-start lg:gap-[15px]">
      <div className="min-w-0">
        <h1 className="font-sora text-[32px] font-bold leading-[38px] lg:text-[52px] lg:leading-[60px]">
          <span className="block text-sub-text-bright">{copy.title[0]}</span>
          <span className="block text-kink-amber">{copy.title[1]}</span>
        </h1>
        <p className="mt-[15px] max-w-[232px] text-[15px] leading-[22px] text-sub-muted lg:mt-[22px] lg:max-w-[340px] lg:text-[17px] lg:leading-[26px]">
          {copy.subtitle}
        </p>
      </div>
      <div className="mt-[6px] lg:mt-[37px]">
        <SilverOctagon alt={copy.medalAlt} phone={[88, 96]} desktop={[112, 122]} />
      </div>
    </div>
  );

  if (p.view !== "form") {
    return (
      <div className="mt-[12px] lg:mt-[44px] lg:max-w-[560px]">
        {heading}
        <div className="mt-[34px]">
          {p.notice ? (
            <PaymentNotice tone={p.notice.tone} title={p.notice.title} body={p.notice.body}>
              <OutlineLink href={p.subscriptionHref} label={copy.back} />
            </PaymentNotice>
          ) : null}
        </div>
      </div>
    );
  }

  const receipt = p.receipt;
  const secure = (
    <div className="flex gap-[12px]">
      <Image src={icon("shield-check")} alt="" width={20} height={20} className="shrink-0" />
      <div>
        <p className="text-[13px] font-bold leading-[20px] text-sub-text-bright lg:text-[14px] lg:leading-[19px]">
          {copy.secureTitle}
        </p>
        <p className="mt-px text-[12px] leading-[16px] text-sub-muted lg:mt-[3px] lg:text-[13px] lg:leading-[18px]">
          {copy.secureBody}
        </p>
      </div>
    </div>
  );
  const uploadButton = (label: string, iconName: string, gold: boolean): ReactNode => (
    <label
      htmlFor={RECEIPT_INPUT}
      className={`flex h-[44px] w-full cursor-pointer items-center justify-center gap-[8px] rounded-[22px] border text-[15px] font-bold focus-within:outline focus-within:outline-2 focus-within:outline-kink-amber lg:h-[48px] lg:rounded-[24px] ${
        gold
          ? "border-sub-pay-gold-line bg-sub-pay-gold text-kink-amber"
          : "border-sub-pay-radio text-sub-text-bright"
      }`}
    >
      <Image src={icon(iconName)} alt="" width={16} height={16} />
      {label}
    </label>
  );

  return (
    <div className="mt-[12px] lg:mt-[44px] lg:grid lg:grid-cols-[520fr_615fr] lg:items-start lg:gap-[64px]">
      <div>
        {heading}
        <section className="mt-[32px] lg:mt-[37px] lg:rounded-[24px] lg:border lg:border-sub-pay-line lg:bg-sub-pay-card lg:px-[28px] lg:pb-[26px] lg:pt-[29px]">
          <SectionHeading
            iconName="receipt"
            title={copy.detailsTitle}
            body={copy.detailsBody}
            bodyClassName="max-w-[232px] lg:max-w-none"
          />
          <div className="mt-[14px] flex flex-col gap-[13px] lg:mt-[23px] lg:gap-[17px]">
            <EditableField
              id="payment-reference"
              label={copy.referenceLabel}
              editable={copy.editable}
              field={p.reference}
            />
            <EditableField
              id="payment-amount"
              label={copy.amountLabel}
              editable={copy.editable}
              field={p.amount}
              prefix="₦"
              inputMode="decimal"
            />
          </div>
        </section>
        <div className="mt-[26px] hidden pl-[3px] lg:block">{secure}</div>
      </div>

      <section className="mt-[33px] border-t border-sub-pay-line pt-[33px] lg:mt-[4px] lg:rounded-[28px] lg:border lg:bg-sub-pay-card lg:px-[33px] lg:pb-[33px] lg:pt-[32px]">
        <SectionHeading iconName="upload" title={copy.uploadTitle} body={copy.uploadBody} />

        <input
          id={RECEIPT_INPUT}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={onFile}
          className="sr-only"
        />
        <div className="mt-[15px] flex items-center gap-[16px] rounded-[20px] border border-sub-pay-line bg-sub-pay-field px-[11px] pb-[13px] pt-[11px] lg:mt-[22px] lg:gap-[25px] lg:px-[15px] lg:py-[16px]">
          <div className="relative shrink-0">
            <div className="h-[160px] w-[96px] rounded-[14px] border border-sub-receipt-line bg-sub-receipt p-[5px] lg:h-[200px] lg:w-[120px] lg:rounded-[17.5px] lg:p-[6.25px]">
              {receipt ? (
                <div className="relative size-full overflow-hidden rounded-[9px] bg-sub-text lg:rounded-[11.25px]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the member's own file */}
                  <img
                    src={receipt.previewUrl}
                    alt={copy.receiptAlt}
                    className="size-full object-cover object-top"
                  />
                  {receipt.uploading ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/55 px-[6px] text-center text-[12px] font-bold text-sub-text-bright">
                      {copy.uploading}
                    </span>
                  ) : null}
                </div>
              ) : (
                <label
                  htmlFor={RECEIPT_INPUT}
                  className="grid size-full cursor-pointer place-items-center rounded-[9px] border border-dashed border-sub-pay-gold-line lg:rounded-[11.25px]"
                >
                  <Image src={icon("upload")} alt={copy.choose} width={22} height={22} />
                </label>
              )}
            </div>
            {receipt && !receipt.uploading ? (
              <Image
                src={icon("check-green")}
                alt=""
                width={28}
                height={28}
                className="absolute -right-[18px] -top-[6px] size-[24px] lg:-right-[24px] lg:-top-[8px] lg:size-[28px]"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[12px] lg:w-[280px] lg:flex-none lg:gap-[11px]">
            {receipt ? (
              <>
                {uploadButton(copy.replace, "pencil", true)}
                <button
                  type="button"
                  onClick={p.onRemoveReceipt}
                  className="flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[22px] border border-sub-pay-radio text-[15px] font-bold text-sub-text-bright lg:h-[48px] lg:rounded-[24px]"
                >
                  <Image src={icon("trash")} alt="" width={16} height={16} />
                  {copy.remove}
                </button>
              </>
            ) : (
              uploadButton(copy.choose, "upload", true)
            )}
          </div>
        </div>

        <div className="mt-[31px] lg:mt-[33px]">
          <Divider />
        </div>

        <div className="mt-[33px] lg:mt-[33px]">
          <SectionHeading
            iconName="user-gold"
            title={copy.senderTitle}
            body={copy.senderBody}
            bodyClassName="max-w-[262px] lg:max-w-none"
          />
        </div>
        <div className="mt-[14px] grid grid-cols-1 gap-[12px] lg:mt-[23px] lg:grid-cols-2 lg:gap-x-[17px] lg:gap-y-[16px]">
          <SenderField
            id="sender-bank"
            iconName="bank-muted"
            label={copy.senderBank.label}
            placeholder={copy.senderBank.placeholder}
            field={p.bank}
            autoComplete="off"
            className="lg:col-span-2"
          />
          <SenderField
            id="sender-name"
            iconName="user-muted"
            label={copy.senderName.label}
            placeholder={copy.senderName.placeholder}
            field={p.name}
            autoComplete="name"
          />
          <SenderField
            id="sender-number"
            iconName="card-muted"
            label={copy.senderNumber.label}
            placeholder={copy.senderNumber.placeholder}
            field={p.number}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>

        <div className="mt-[32px] rounded-[16px] border border-sub-pay-line bg-sub-pay-card px-[16px] pb-[17px] pt-[18px] lg:hidden">
          {secure}
        </div>

        <div className="-mx-[20px] mt-[26px] px-[20px] pb-[max(24px,env(safe-area-inset-bottom))] lg:mx-0 lg:mt-[32px] lg:px-0 lg:pb-0">
          {p.error ? (
            <p role="alert" className="mb-[12px] text-[14px] text-sub-danger">
              {p.error}
            </p>
          ) : null}
          <div className="lg:[&>button]:h-[60px] lg:[&>button]:rounded-[30px]">
            <GoldButton
              label={p.submitting ? copy.submitting : copy.cta}
              onClick={p.onSubmit}
              disabled={p.submitting}
              arrow
            />
          </div>
        </div>
      </section>
    </div>
  );
}
