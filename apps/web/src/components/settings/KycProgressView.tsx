import KycVerifiedMark from "@/components/brand/KycVerifiedMark";

interface KycProgressStageVM {
  key: string;
  title: string;
  description: string;
  available: boolean;
  status: string;
  statusLabel: string;
}

export interface KycProgressViewProps {
  fullKycVerified: boolean;
  stages: KycProgressStageVM[];
  locationConsentAccepted: boolean;
  locationBusy: boolean;
  residenceConsentAccepted: boolean;
  residenceBusy: boolean;
  consents: {
    location: boolean;
    residence: boolean;
  };
  residenceEvidenceReady: boolean;
  onLocationConsentChange: (accepted: boolean) => void;
  onCaptureLocation: () => void;
  onResidenceConsentChange: (accepted: boolean) => void;
  onRecordResidenceConsent: () => void;
  onRefresh: () => void;
}

const statusClass: Record<string, string> = {
  Complete: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  "In progress": "border-kink-amber/40 bg-kink-amber/10 text-kink-gold-bright",
  "Under review": "border-kink-amber/40 bg-kink-amber/10 text-kink-gold-bright",
  "Needs attention": "border-red-500/40 bg-red-500/10 text-red-300",
  "Not available": "border-neutral-700 bg-neutral-800/50 text-neutral-400",
  "Not started": "border-neutral-700 bg-neutral-800/50 text-neutral-300",
  Expired: "border-red-500/40 bg-red-500/10 text-red-300",
};

/** Dumb KYC progress display; all status derivation stays in the presenter/service. */
export default function KycProgressView({
  fullKycVerified,
  stages,
  locationConsentAccepted,
  locationBusy,
  residenceConsentAccepted,
  residenceBusy,
  consents,
  residenceEvidenceReady,
  onLocationConsentChange,
  onCaptureLocation,
  onResidenceConsentChange,
  onRecordResidenceConsent,
  onRefresh,
}: KycProgressViewProps) {
  return (
    <section className="rounded-2xl border border-app-card-border bg-app-card p-5 text-app-text sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {fullKycVerified ? <KycVerifiedMark size={24} /> : null}
            <h1 className="text-2xl font-black text-kink-gold-bright">Kinkord KYC</h1>
          </div>
          <p className="mt-2 text-sm leading-6 text-app-subtle">
            Complete all three safeguards to receive Kinkord KYC verified status. Identity completion
            alone is not full KYC.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="shrink-0 text-sm font-bold text-kink-gold-bright underline underline-offset-4"
        >
          Refresh
        </button>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {stages.map((stage, index) => (
          <li key={stage.key} className="rounded-xl border border-app-card-border bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-white">
                <span className="mr-2 text-kink-gold-bright">{index + 1}.</span>
                {stage.title}
              </p>
              <span
                className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass[stage.statusLabel] ?? statusClass["Not started"]}`}
              >
                {stage.statusLabel}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-app-subtle">{stage.description}</p>
            {stage.key === "residence" && stage.available && stage.status !== "passed" ? (
              <div className="mt-3 rounded-lg border border-kink-amber/30 bg-kink-amber/5 p-3">
                <label className="flex items-start gap-2 text-xs leading-5 text-app-subtle">
                  <input
                    type="checkbox"
                    checked={residenceConsentAccepted}
                    disabled={consents.residence}
                    onChange={(event) => onResidenceConsentChange(event.target.checked)}
                    className="mt-1 accent-kink-amber"
                  />
                  <span>
                    I consent to Kinkord checking a recent proof-of-address document I submit during
                    the identity session, including its issue date, to verify my residence. Kinkord
                    stores only the verification result, not my document or address.
                    {consents.residence ? " Consent recorded." : ""}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={
                    !residenceConsentAccepted ||
                    residenceBusy ||
                    (consents.residence && !residenceEvidenceReady)
                  }
                  onClick={onRecordResidenceConsent}
                  className="mt-3 rounded-lg bg-kink-amber px-3 py-2 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {residenceBusy
                    ? "Checking residence…"
                    : consents.residence
                      ? residenceEvidenceReady
                        ? "Check proof-of-address result"
                        : "Consent recorded — complete identity first"
                      : "Confirm residence consent"}
                </button>
              </div>
            ) : null}
            {stage.key === "location" && stage.available && stage.status !== "passed" ? (
              <div className="mt-3 rounded-lg border border-kink-amber/30 bg-kink-amber/5 p-3">
                <label className="flex items-start gap-2 text-xs leading-5 text-app-subtle">
                  <input
                    type="checkbox"
                    checked={locationConsentAccepted}
                    disabled={consents.location}
                    onChange={(event) => onLocationConsentChange(event.target.checked)}
                    className="mt-1 accent-kink-amber"
                  />
                  <span>
                    I consent to Kinkord using this device&apos;s one-time live location only to
                    compare it with my approved proof of address. Kinkord stores the result, not my
                    coordinates.
                    {consents.location ? " Consent recorded." : ""}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={!locationConsentAccepted || locationBusy}
                  onClick={onCaptureLocation}
                  className="mt-3 rounded-lg bg-kink-amber px-3 py-2 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locationBusy ? "Checking location…" : "Confirm live location"}
                </button>
              </div>
            ) : null}
            {!stage.available ? (
              <p className="mt-3 text-xs font-semibold text-neutral-500">
                This safeguard will remain unavailable until its provider and privacy controls are
                approved.
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
