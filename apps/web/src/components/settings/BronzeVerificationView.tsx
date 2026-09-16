import Link from "next/link";

export interface BronzeVerificationViewProps {
  status: string;
  attemptsRemaining: number;
  missing: string[];
  checked: boolean;
  onChecked: (value: boolean) => void;
  busy: boolean;
  canStart: boolean;
  providerAvailable: boolean;
  policyUrl: string | null;
  onStart: () => void;
  onRefresh: () => void;
  editProfileHref: string;
}

const card = "rounded-[16px] border border-app-card-border bg-app-card p-[18px]";

export default function BronzeVerificationView(p: BronzeVerificationViewProps) {
  return <div className="flex flex-col gap-5 text-app-text">
    <div>
      <h1 className="text-[24px] font-black text-kink-gold-bright">Bronze verification</h1>
      <p className="mt-2 text-sm text-app-subtle">Verify your government ID, live face, and current profile photo. Your identity documents and camera capture are never displayed on your profile.</p>
    </div>
    <section className={card}>
      <h2 className="font-bold">Status: {p.status}</h2>
      <p className="mt-2 text-sm">{p.attemptsRemaining} automated attempt{p.attemptsRemaining === 1 ? "" : "s"} remaining (maximum 3).</p>
      <button type="button" onClick={p.onRefresh} className="mt-3 text-sm font-bold text-kink-gold-bright underline">Refresh status</button>
    </section>
    {p.missing.length ? <section className={card}>
      <h2 className="font-bold">Before you begin</h2>
      <p className="mt-2 text-sm">Add {p.missing.join(", ")} to your profile first. Your profile photo must be a genuine image of you uploaded in the last 90 days.</p>
      <Link href={p.editProfileHref} className="mt-3 inline-block font-bold text-kink-gold-bright underline">Edit profile</Link>
    </section> : null}
    <section className={card}>
      <h2 className="font-bold">What we check</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        <li>Your supported government ID and official ID details.</li>
        <li>A live camera capture and face match to the government ID.</li>
        <li>Your live face against your current Kinkord profile photo.</li>
        <li>Date of birth, gender and country against your profile.</li>
      </ol>
      <p className="mt-3 text-sm text-app-subtle">An inconclusive result or three failed attempts goes to manual review; the badge is never awarded on a partial result.</p>
    </section>
    <section className={card}>
      {p.policyUrl ? <a href={p.policyUrl} target="_blank" rel="noopener noreferrer" className="mb-3 inline-block text-sm font-bold text-kink-gold-bright underline">Read the biometric & identity privacy notice</a> : null}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 accent-kink-amber" checked={p.checked} onChange={(e) => p.onChecked(e.target.checked)} />
        <span>I consent to Kinkord and its verification provider (Didit, or Smile ID if a fallback is needed) processing my government ID information and live biometric images for Bronze verification, fraud prevention, and review. I understand the results may require manual review.</span>
      </label>
      <button type="button" disabled={!p.canStart} onClick={p.onStart} className="mt-5 w-full rounded-xl bg-kink-amber p-3 font-bold text-black disabled:opacity-50">
        {p.busy ? "Starting…" : "Start Bronze verification"}
      </button>
      {!p.providerAvailable ? <p className="mt-2 text-sm text-app-subtle">The verification service is not configured yet.</p> : null}
    </section>
  </div>;
}
