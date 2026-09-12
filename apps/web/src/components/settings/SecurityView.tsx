import CodeInput from "@/components/auth/CodeInput";

export interface SecurityViewProps {
  title: string;
  subtitle: string;
  twoFactor: {
    heading: string;
    on: boolean;
    statusLabel: string;
    description: string;
    passwordLabel: string;
    password: string;
    onPassword: (value: string) => void;
    actionLabel: string;
    onAction: () => void;
    setup: {
      instructions: string;
      qrDataUrl: string;
      qrAlt: string;
      backupTitle: string;
      backupCodes: string[];
      code: string;
      onCode: (value: string) => void;
      confirmLabel: string;
      onConfirm: () => void;
    } | null;
  };
  password: {
    heading: string;
    currentLabel: string;
    nextLabel: string;
    helper: string;
    current: string;
    next: string;
    onCurrent: (value: string) => void;
    onNext: (value: string) => void;
    submitLabel: string;
    onSubmit: () => void;
  };
  busy: boolean;
  error: string | null;
  notice: string | null;
}

const input =
  "h-[44px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[14px] text-[15px] text-app-value outline-none focus:border-kink-amber";
const label = "block pb-[4px] text-[13px] font-bold text-app-text";
const card =
  "flex flex-col gap-[14px] rounded-[16px] border border-app-card-border bg-app-card p-[18px]";
const gold =
  "h-[46px] rounded-[12px] bg-kink-amber px-[18px] text-[15px] font-bold text-black disabled:opacity-60";

/** Settings → Security & 2FA: TOTP lifecycle + change password, in the app's theme tokens. */
export default function SecurityView(p: SecurityViewProps) {
  const { twoFactor: tf, password: pw } = p;
  return (
    <div className="flex w-full flex-col gap-[20px]">
      <div>
        <h1 className="text-[22px] font-black text-kink-gold-bright">{p.title}</h1>
        <p className="text-[13px] text-app-subtle">{p.subtitle}</p>
      </div>

      <section className={card}>
        <p className="text-[16px] font-bold text-app-text">
          {tf.heading}:{" "}
          <span className={tf.on ? "text-kink-gold-bright" : "text-app-subtle"}>
            {tf.statusLabel}
          </span>
        </p>
        <p className="text-[13px] text-app-subtle">{tf.description}</p>
        {tf.setup ? (
          <div className="flex flex-col items-center gap-[14px] rounded-[12px] border border-kink-amber/50 p-[16px]">
            <p className="text-center text-[14px] text-app-text">{tf.setup.instructions}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- locally generated data URL */}
            <img
              src={tf.setup.qrDataUrl}
              alt={tf.setup.qrAlt}
              className="rounded-[8px] bg-white p-2"
            />
            <details className="w-full text-[13px] text-app-subtle">
              <summary className="cursor-pointer text-kink-gold-bright">
                {tf.setup.backupTitle}
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-1 font-mono">
                {tf.setup.backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </details>
            <CodeInput value={tf.setup.code} onChange={tf.setup.onCode} />
            <button
              type="button"
              onClick={tf.setup.onConfirm}
              disabled={p.busy}
              className={`${gold} w-full`}
            >
              {tf.setup.confirmLabel}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-[10px] sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className={label}>{tf.passwordLabel}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={tf.password}
                onChange={(e) => tf.onPassword(e.target.value)}
                className={input}
              />
            </label>
            <button type="button" onClick={tf.onAction} disabled={p.busy} className={gold}>
              {tf.actionLabel}
            </button>
          </div>
        )}
      </section>

      <section className={card}>
        <p className="text-[16px] font-bold text-app-text">{pw.heading}</p>
        <div className="grid gap-[12px] sm:grid-cols-2">
          <label className="block">
            <span className={label}>{pw.currentLabel}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => pw.onCurrent(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>{pw.nextLabel}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => pw.onNext(e.target.value)}
              className={input}
            />
            <span className="block pt-[4px] text-[11px] text-app-subtle">{pw.helper}</span>
          </label>
        </div>
        <button
          type="button"
          onClick={pw.onSubmit}
          disabled={p.busy}
          className={`${gold} self-start`}
        >
          {pw.submitLabel}
        </button>
      </section>

      {p.error ? <p className="text-[13px] font-semibold text-red-500">{p.error}</p> : null}
      {p.notice ? (
        <p className="text-[13px] font-semibold text-kink-gold-bright">{p.notice}</p>
      ) : null}
    </div>
  );
}
