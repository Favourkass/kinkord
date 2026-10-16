import { UserPlus } from "lucide-react";
export interface FriendshipActionProps {
  label: string;
  secondaryLabel: string | null;
  busy: boolean;
  error: string | null;
  onPrimary: () => void;
  onSecondary: () => void;
}
export default function FriendshipAction(p: FriendshipActionProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <button
        type="button"
        onClick={p.onPrimary}
        disabled={p.busy}
        className="flex min-h-9 w-full items-center justify-center gap-1 rounded-xl border border-kink-gold-bright px-1 text-[11px] font-bold text-kink-gold-bright disabled:opacity-60"
      >
        <UserPlus size={15} aria-hidden />
        {p.label}
      </button>
      {p.secondaryLabel && (
        <button
          type="button"
          onClick={p.onSecondary}
          disabled={p.busy}
          className="min-h-8 text-xs text-pf-muted underline disabled:opacity-60"
        >
          {p.secondaryLabel}
        </button>
      )}
      {p.error && (
        <p role="alert" className="text-xs text-app-danger">
          {p.error}
        </p>
      )}
    </div>
  );
}
