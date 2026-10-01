"use client";

export interface PushSettingRowProps {
  heading: string;
  label: string;
  description: string;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
  error: string | null;
}

/** Settings → Notifications: push for this device, on or off. */
export default function PushSettingRow(p: PushSettingRowProps) {
  return (
    <>
      <p className="pt-[28px] pb-[8px] text-[14px] font-bold text-app-text">{p.heading}</p>
      <div className="flex items-center gap-[12px] rounded-[16px] bg-app-members px-[18px] py-[14px]">
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-medium text-app-name">{p.label}</p>
          <p className="pt-[2px] text-[13px] text-app-muted">{p.description}</p>
        </div>
        <button
          type="button"
          onClick={p.onAction}
          disabled={p.actionDisabled}
          className="shrink-0 rounded-full border border-kink-amber px-[14px] py-[7px] text-[14px] font-bold text-kink-amber disabled:opacity-40"
        >
          {p.actionLabel}
        </button>
      </div>
      {p.error && <p className="pt-[6px] text-[13px] text-app-danger">{p.error}</p>}
    </>
  );
}
