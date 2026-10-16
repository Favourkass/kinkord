"use client";

import { useParams } from "next/navigation";
import BankTransferView from "@/components/subscription/BankTransferView";
import SubscriptionChrome from "@/components/subscription/SubscriptionChrome";
import { SUBSCRIPTION_COPY } from "@/constants/subscription";
import { usePaymentPresenter } from "@/presenters/usePaymentPresenter";

/** Paying by bank transfer (Figma 46:2 phone, 46:135 desktop). */
export default function SubscriptionPayPage() {
  const { id } = useParams<{ id: string }>();
  const p = usePaymentPresenter(id);
  const copy = SUBSCRIPTION_COPY.pay;
  return (
    <SubscriptionChrome
      tone="black"
      glow={{ phone: true, desktop: false }}
      back={{ label: SUBSCRIPTION_COPY.back, icon: "chevron", href: p.backHref }}
      secure={SUBSCRIPTION_COPY.securePayment}
      width="payment"
      footer
    >
      {p.view && p.amount && p.bank && p.reference ? (
        <BankTransferView
          copy={{
            title: copy.title,
            subtitle: copy.subtitle,
            medalAlt: SUBSCRIPTION_COPY.upgrade.medalAlt,
            amountTitle: copy.amountTitle,
            amountBody: copy.amountBody,
            expiresIn: copy.expiresIn,
            uniqueTitle: copy.uniqueTitle,
            uniqueBody: copy.uniqueBody,
            bankTitle: copy.bankTitle,
            bankBody: copy.bankBody,
            bankName: copy.bankName,
            accountName: copy.accountName,
            accountNumber: copy.accountNumber,
            referenceTitle: copy.referenceTitle,
            referenceBody: copy.referenceBody,
            confirm: copy.confirm,
            cta: copy.cta,
            expired: copy.expired,
            back: SUBSCRIPTION_COPY.state.back,
          }}
          view={p.view}
          plans={p.plans}
          onSelectPlan={p.selectPlan}
          switching={p.switching}
          countdown={p.countdown}
          amount={p.amount}
          bank={p.bank}
          reference={p.reference}
          notice={p.notice}
          confirmed={p.confirmed}
          onToggleConfirmed={p.toggleConfirmed}
          canContinue={p.canContinue}
          onContinue={p.proceed}
          onRestart={p.restart}
          subscriptionHref={p.backHref}
          error={p.error}
        />
      ) : (
        <p role={p.error ? "alert" : "status"} className="mt-[40px] text-[15px] text-sub-muted">
          {p.error ?? SUBSCRIPTION_COPY.loading}
        </p>
      )}
    </SubscriptionChrome>
  );
}
