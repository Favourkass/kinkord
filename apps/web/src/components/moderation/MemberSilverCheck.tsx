import SilverCheck from "@/components/app/SilverCheck";
import type { MemberCheckVM } from "@/domain/subscription";

export interface MemberSilverCheckProps {
  vm: MemberCheckVM;
  error: string | null;
  notice: string | null;
  busy: boolean;
  onApprove: () => void;
  onRemove: () => void;
  labels: { title: string; approve: string; remove: string };
}

/** A member's Silver check on their admin page: where it stands, and the admin's say over it. */
export default function MemberSilverCheck(p: MemberSilverCheckProps) {
  return (
    <section className="mt-[16px] rounded-[16px] border border-app-card-border bg-app-card p-[14px]">
      <h2 className="flex flex-wrap items-center gap-[6px] text-[14px] font-bold text-app-text">
        <SilverCheck size={16} className={p.vm.shown ? "" : "opacity-40 grayscale"} />
        {p.labels.title}
        <span className="font-normal text-app-subtle">· {p.vm.until}</span>
      </h2>
      <p className="pt-[6px] text-[14px] text-app-value">{p.vm.status}</p>
      {p.notice ? (
        <p role="status" className="pt-[8px] text-[14px] font-bold text-app-online">
          {p.notice}
        </p>
      ) : null}
      {p.error ? <p className="pt-[8px] text-[14px] text-app-danger">{p.error}</p> : null}
      {p.vm.canApprove || p.vm.canRemove ? (
        <div className="flex flex-wrap items-center gap-[8px] pt-[12px]">
          {p.vm.canApprove ? (
            <button
              type="button"
              onClick={p.onApprove}
              disabled={p.busy}
              className="rounded-[10px] bg-kink-amber px-[14px] py-[8px] text-[13px] font-bold text-black disabled:opacity-60"
            >
              {p.labels.approve}
            </button>
          ) : null}
          {p.vm.canRemove ? (
            <button
              type="button"
              onClick={p.onRemove}
              disabled={p.busy}
              className="rounded-[10px] px-[12px] py-[8px] text-[13px] font-bold text-app-danger hover:bg-app-input disabled:opacity-60"
            >
              {p.labels.remove}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
