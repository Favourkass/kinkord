"use client";

import ConfirmDialog from "@/components/moderation/ConfirmDialog";
import ModerationFrame from "@/components/moderation/ModerationFrame";
import PaymentSettingsCard from "@/components/moderation/PaymentSettingsCard";
import PaymentsView from "@/components/moderation/PaymentsView";
import SilverChecksCard from "@/components/moderation/SilverChecksCard";
import { MODERATION_COPY } from "@/constants/moderation";
import { useAdminPaymentsPresenter } from "@/presenters/useAdminPaymentsPresenter";
import { useAdminSilverChecksPresenter } from "@/presenters/useAdminSilverChecksPresenter";
import { usePaymentSettingsPresenter } from "@/presenters/usePaymentSettingsPresenter";
import { moderationTabs } from "../tabs";

/** Silver payments: check each transfer against the statement, then verify or reject it. */
export default function ModerationPaymentsPage() {
  const p = useAdminPaymentsPresenter();
  const s = usePaymentSettingsPresenter(p.isAdmin);
  const c = useAdminSilverChecksPresenter(p.isAdmin);
  const copy = MODERATION_COPY;
  return (
    <ModerationFrame
      title={copy.title}
      tabs={moderationTabs("payments")}
      checking={p.checking}
      isAdmin={p.isAdmin}
      checkingLabel={copy.checking}
      deniedLabel={copy.denied}
    >
      <PaymentSettingsCard
        loading={s.loading}
        canEdit={s.canEdit}
        bank={s.bank}
        prices={s.prices}
        editing={s.editing}
        onEdit={s.edit}
        onCancel={s.cancel}
        form={s.form}
        onField={s.setField}
        saving={s.saving}
        onSave={s.save}
        error={s.error}
        notice={s.notice}
        labels={s.labels}
      />
      <div className="pt-[16px]">
        <SilverChecksCard
          loading={c.loading}
          error={c.error}
          notice={c.notice}
          empty={c.empty}
          rows={c.rows}
          onApprove={c.onApprove}
          labels={c.labels}
        />
      </div>
      <div className="pt-[20px]">
        <PaymentsView
          statuses={p.statuses}
          onStatus={p.setStatus}
          query={p.query}
          onQuery={p.setQuery}
          loading={p.loading}
          error={p.error}
          notice={p.notice}
          empty={p.empty}
          rows={p.rows}
          onVerify={p.askVerify}
          onReject={p.askReject}
          labels={p.labels}
        />
      </div>
      {p.dialog ? <ConfirmDialog dialog={p.dialog} /> : null}
    </ModerationFrame>
  );
}
