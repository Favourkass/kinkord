"use client";

import { useParams } from "next/navigation";
import PaymentProofView from "@/components/subscription/PaymentProofView";
import SubscriptionChrome from "@/components/subscription/SubscriptionChrome";
import { SUBSCRIPTION_COPY } from "@/constants/subscription";
import { usePaymentProofPresenter } from "@/presenters/usePaymentProofPresenter";

/** Sending proof of the transfer (Figma 48:348 phone, 48:111 desktop). */
export default function SubscriptionProofPage() {
  const { id } = useParams<{ id: string }>();
  const p = usePaymentProofPresenter(id);
  const copy = SUBSCRIPTION_COPY.proof;
  return (
    <SubscriptionChrome
      tone="ink"
      glow={{ phone: true, desktop: true }}
      back={{ label: SUBSCRIPTION_COPY.back, icon: "chevron", href: p.backHref }}
      width="payment"
      footer={p.view === "form"}
    >
      {p.view ? (
        <PaymentProofView
          copy={{
            ...copy,
            medalAlt: SUBSCRIPTION_COPY.upgrade.medalAlt,
            back: SUBSCRIPTION_COPY.state.back,
          }}
          view={p.view}
          notice={p.notice}
          subscriptionHref={p.subscriptionHref}
          reference={{ value: p.reference, onChange: p.setReference }}
          amount={{ value: p.amount, onChange: p.setAmount }}
          bank={{ value: p.bank, onChange: p.setBank }}
          name={{ value: p.name, onChange: p.setName }}
          number={{ value: p.number, onChange: p.setNumber }}
          receipt={p.receipt}
          onPickReceipt={p.pickReceipt}
          onRemoveReceipt={p.removeReceipt}
          error={p.error}
          submitting={p.submitting}
          onSubmit={p.submit}
        />
      ) : (
        <p role={p.loadError ? "alert" : "status"} className="mt-[40px] text-[15px] text-sub-muted">
          {p.loadError ?? SUBSCRIPTION_COPY.loading}
        </p>
      )}
    </SubscriptionChrome>
  );
}
