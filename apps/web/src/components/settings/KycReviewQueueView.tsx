interface KycReviewQueueItemVM {
  id: string;
  caseUserId: string;
  stage: string;
  reasonCodes: string[];
  provider: string | null;
  providerReference: string | null;
  summary: Record<string, boolean | number | string> | null;
  createdLabel: string;
  evidenceReference: string;
  reason: string;
  busy: boolean;
  onEvidenceReference: (value: string) => void;
  onReason: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export interface KycReviewQueueViewProps {
  title: string;
  guidance: string;
  empty: boolean;
  items: KycReviewQueueItemVM[];
  onRefresh: () => void;
}

const input = "w-full rounded-xl border border-app-input-border bg-app-input px-3 py-2 text-sm text-app-value outline-none focus:border-kink-amber";

/** Generic staff queue: receives display-ready derived evidence, never provider payloads. */
export default function KycReviewQueueView(p: KycReviewQueueViewProps) {
  return <div className="flex flex-col gap-5 text-app-text">
    <header>
      <h1 className="text-2xl font-black text-kink-gold-bright">{p.title}</h1>
      <p className="mt-2 text-sm leading-6 text-app-subtle">{p.guidance}</p>
      <button type="button" onClick={p.onRefresh} className="mt-3 text-sm font-bold text-kink-gold-bright underline">Refresh queue</button>
    </header>
    {p.empty ? <p className="rounded-2xl border border-app-card-border bg-app-card p-5 text-sm text-app-subtle">There are no open non-identity KYC reviews.</p> : null}
    {p.items.map((item) => <section key={item.id} className="rounded-2xl border border-app-card-border bg-app-card p-5 text-sm">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="font-bold">Member case</dt><dd className="break-all text-app-subtle">{item.caseUserId}</dd></div>
        <div><dt className="font-bold">Stage</dt><dd className="capitalize text-app-subtle">{item.stage}</dd></div>
        <div><dt className="font-bold">Provider</dt><dd className="text-app-subtle">{item.provider ?? "Unavailable"}</dd></div>
        <div><dt className="font-bold">Provider reference</dt><dd className="break-all text-app-subtle">{item.providerReference ?? "Unavailable"}</dd></div>
        <div><dt className="font-bold">Queued</dt><dd className="text-app-subtle">{item.createdLabel}</dd></div>
        <div><dt className="font-bold">Reason codes</dt><dd className="text-app-subtle">{item.reasonCodes.join(", ")}</dd></div>
      </dl>
      <p className="mt-4 rounded-lg border border-app-card-border bg-black/20 p-3 text-xs leading-5 text-app-subtle">Derived checks: {item.summary ? Object.entries(item.summary).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "No derived checks available"}</p>
      <div className="mt-5 space-y-4 border-t border-app-card-border pt-5">
        <label className="block font-bold">Evidence reference
          <input value={item.evidenceReference} onChange={(event) => item.onEvidenceReference(event.target.value)} className={`${input} mt-1`} placeholder="Mono, Didit, or internal protected case reference" />
        </label>
        <label className="block font-bold">Review notes
          <textarea value={item.reason} onChange={(event) => item.onReason(event.target.value)} className={`${input} mt-1 min-h-24`} placeholder="Explain the decision without copying sensitive evidence." />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={item.busy} onClick={item.onApprove} className="rounded-xl bg-kink-amber px-5 py-3 font-bold text-black disabled:opacity-50">Approve stage</button>
          <button type="button" disabled={item.busy} onClick={item.onReject} className="rounded-xl border border-red-500 px-5 py-3 font-bold text-red-500 disabled:opacity-50">Reject stage</button>
        </div>
      </div>
    </section>)}
  </div>;
}
