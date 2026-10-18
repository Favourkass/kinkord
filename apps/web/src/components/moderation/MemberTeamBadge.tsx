import TeamBadge from "@/components/app/TeamBadge";
export interface MemberTeamBadgeProps {
  assigned: boolean;
  /** Founders only; other admins see whether the member has it. */
  canChange: boolean;
  onToggle: () => void;
  labels: {
    title: string;
    body: string;
    assigned: string;
    unassigned: string;
    assign: string;
    remove: string;
    foundersOnly: string;
  };
}
export default function MemberTeamBadge({
  assigned,
  canChange,
  onToggle,
  labels,
}: MemberTeamBadgeProps) {
  return (
    <section className="mt-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[14px]">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-kink-amber">
        <TeamBadge />
        {labels.title}
      </h2>
      <p className="mt-2 text-[13px] text-app-subtle">{labels.body}</p>
      <p className="mt-2 text-[14px] text-app-value">
        {assigned ? labels.assigned : labels.unassigned}
      </p>
      {canChange ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 rounded-xl border border-kink-amber px-4 py-2 font-bold text-kink-amber"
        >
          {assigned ? labels.remove : labels.assign}
        </button>
      ) : (
        <p className="mt-2 text-[12px] text-app-subtle">{labels.foundersOnly}</p>
      )}
    </section>
  );
}
