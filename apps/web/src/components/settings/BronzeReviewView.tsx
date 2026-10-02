import type { BronzeChecks } from "@/domain/bronzeVerification";

interface BronzeReviewItemVM {
  id: string;
  userId: string;
  reasonCodes: string[];
  providerJobId: string;
  profilePhotoUrl: string;
  checks: BronzeChecks;
  createdLabel: string;
  profileFaceMatches: boolean;
  evidenceReference: string;
  reason: string;
  busy: boolean;
  onProfileFaceMatches: (value: boolean) => void;
  onEvidenceReference: (value: string) => void;
  onReason: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export interface BronzeReviewViewProps {
  title: string;
  guidance: string;
  providerConsoleHref: string;
  empty: boolean;
  items: BronzeReviewItemVM[];
  onRefresh: () => void;
}

const input =
  "w-full rounded-xl border border-app-input-border bg-app-input px-3 py-2 text-sm text-app-value outline-none focus:border-kink-amber";

export default function BronzeReviewView(p: BronzeReviewViewProps) {
  return (
    <div className="flex flex-col gap-5 text-app-text">
      <header>
        <h1 className="text-2xl font-black text-kink-gold-bright">{p.title}</h1>
        <p className="mt-2 text-sm leading-6 text-app-subtle">{p.guidance}</p>
        <div className="mt-3 flex gap-4 text-sm font-bold">
          <button type="button" onClick={p.onRefresh} className="text-kink-gold-bright underline">
            Refresh queue
          </button>
          <a
            href={p.providerConsoleHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-kink-gold-bright underline"
          >
            Open Didit console
          </a>
        </div>
      </header>
      {p.empty ? (
        <p className="rounded-2xl border border-app-card-border bg-app-card p-5 text-sm text-app-subtle">
          There are no open KYC reviews.
        </p>
      ) : null}
      {p.items.map((item) => (
        <section
          key={item.id}
          className="rounded-2xl border border-app-card-border bg-app-card p-5"
        >
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed private-media URL */}
            <img
              src={item.profilePhotoUrl}
              alt="Profile photo captured for this verification attempt"
              className="aspect-square w-full rounded-xl object-cover"
            />
            <div className="min-w-0 space-y-3 text-sm">
              <p>
                <span className="font-bold">User:</span> {item.userId}
              </p>
              <p className="break-all">
                <span className="font-bold">Provider reference:</span> {item.providerJobId}
              </p>
              <p>
                <span className="font-bold">Queued:</span> {item.createdLabel}
              </p>
              <p>
                <span className="font-bold">Reason:</span> {item.reasonCodes.join(", ")}
              </p>
              <p>
                <span className="font-bold">Passed checks:</span>{" "}
                {Object.entries(item.checks)
                  .filter(([, passed]) => passed)
                  .map(([name]) => name)
                  .join(", ") || "None"}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4 border-t border-app-card-border pt-5">
            <label className="flex items-start gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={item.profileFaceMatches}
                onChange={(event) => item.onProfileFaceMatches(event.target.checked)}
                className="mt-1 accent-kink-amber"
              />
              I inspected the Didit live capture and confirm it matches this exact profile photo.
            </label>
            <label className="block text-sm font-bold">
              Evidence reference
              <input
                value={item.evidenceReference}
                onChange={(event) => item.onEvidenceReference(event.target.value)}
                className={`${input} mt-1`}
                placeholder="Didit session or internal case reference"
              />
            </label>
            <label className="block text-sm font-bold">
              Review notes
              <textarea
                value={item.reason}
                onChange={(event) => item.onReason(event.target.value)}
                className={`${input} mt-1 min-h-24`}
                placeholder="Explain the decision without copying sensitive ID data."
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={item.busy}
                onClick={item.onApprove}
                className="rounded-xl bg-kink-amber px-5 py-3 font-bold text-black disabled:opacity-50"
              >
                Approve identity stage
              </button>
              <button
                type="button"
                disabled={item.busy}
                onClick={item.onReject}
                className="rounded-xl border border-red-500 px-5 py-3 font-bold text-red-500 disabled:opacity-50"
              >
                Reject match
              </button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
