import TeamBadge from "@/components/app/TeamBadge";
export interface MemberTeamBadgeProps {
  assigned: boolean;
  onToggle: () => void;
  labels: {
    title: string;
    body: string;
    assigned: string;
    unassigned: string;
    assign: string;
    remove: string;
  };
}
export default function MemberTeamBadge({ assigned, onToggle, labels }: MemberTeamBadgeProps) {
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
      <button
        type="button"
        onClick={onToggle}
        className="mt-3 rounded-xl border border-kink-amber px-4 py-2 font-bold text-kink-amber"
      >
        {assigned ? labels.remove : labels.assign}
      </button>
    </section>
  );
}
