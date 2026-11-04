import Link from "next/link";
import type { AdminMemberRingsVM } from "@/presenters/useAdminMemberRingsPresenter";

const tone = {
  unused: "text-app-text",
  given: "text-kink-amber",
  expired: "text-app-muted",
  cancelled: "text-app-danger",
} as const;

function CancelButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="rounded-[8px] border border-app-input-border px-[8px] py-[2px] text-[12px] font-bold text-app-danger hover:bg-app-input"
    >
      {label}
    </button>
  );
}

/**
 * A member's Kink Rings on their admin page: their balance, each payment's
 * rings, and the ones they received, with the admin's cancel buttons.
 */
export default function MemberKinkRings({
  title,
  loading,
  empty,
  receivedTitle,
  vm,
  error,
  notice,
  cancelUnusedLabel,
  onCancelUnused,
  cancelSilverLabel,
  onCancelSilver,
}: AdminMemberRingsVM) {
  return (
    <section aria-label={title} className="pt-[28px]">
      <h2 className="pb-[6px] text-[14px] font-bold text-app-text">{title}</h2>
      {error ? <p className="text-[14px] text-app-danger">{error}</p> : null}
      {loading ? <p className="text-[14px] text-app-muted">{loading}</p> : null}
      {notice ? (
        <p role="status" className="pb-[6px] text-[13px] text-kink-amber">
          {notice}
        </p>
      ) : null}
      {vm ? (
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] pb-[10px]">
          <p className="text-[13px] text-app-subtle">{vm.summary}</p>
          {cancelUnusedLabel ? (
            <CancelButton label={cancelUnusedLabel} onPress={onCancelUnused} />
          ) : null}
        </div>
      ) : null}
      {empty ? <p className="text-[14px] text-app-subtle">{empty}</p> : null}
      {vm?.batches.map((batch) => (
        <div
          key={batch.key}
          className="mb-[10px] rounded-[14px] border border-app-card-border bg-app-card px-[12px] py-[10px]"
        >
          <p className="pb-[6px] text-[13px] font-bold text-app-text">{batch.heading}</p>
          <ul className="flex flex-col gap-[4px] text-[13px]">
            {batch.rings.map((ring) => (
              <li key={ring.id} className="flex flex-wrap items-baseline gap-x-[8px]">
                <span className="w-[56px] shrink-0 text-app-muted">{ring.label}</span>
                <span className={`w-[72px] shrink-0 font-semibold ${tone[ring.status]}`}>
                  {ring.statusLabel}
                </span>
                {ring.href ? (
                  <Link
                    href={ring.href}
                    className="text-app-text underline-offset-2 hover:underline"
                  >
                    {ring.line}
                  </Link>
                ) : (
                  <span className="text-app-subtle">{ring.line}</span>
                )}
                {ring.cancelSilverOf ? (
                  <CancelButton
                    label={cancelSilverLabel}
                    onPress={() => onCancelSilver(ring.id, ring.cancelSilverOf!)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {vm && vm.received.length > 0 ? (
        <div className="rounded-[14px] border border-app-card-border bg-app-card px-[12px] py-[10px]">
          <p className="pb-[6px] text-[13px] font-bold text-app-text">{receivedTitle}</p>
          <ul className="flex flex-col gap-[4px] text-[13px]">
            {vm.received.map((ring) => (
              <li key={ring.id} className="flex flex-wrap items-baseline gap-x-[8px]">
                {ring.href ? (
                  <Link
                    href={ring.href}
                    className="text-app-text underline-offset-2 hover:underline"
                  >
                    {ring.line}
                  </Link>
                ) : (
                  <span className="text-app-subtle">{ring.line}</span>
                )}
                {ring.cancelSilverOf ? (
                  <CancelButton
                    label={cancelSilverLabel}
                    onPress={() => onCancelSilver(ring.id, ring.cancelSilverOf!)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
