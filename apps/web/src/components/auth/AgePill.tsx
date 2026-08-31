import { ShieldCheckIcon } from "./AuthIcons";

interface AgePillProps {
  lead: string;
  rest: string;
}

export default function AgePill({ lead, rest }: AgePillProps) {
  return (
    <div className="flex w-full items-center justify-center gap-2 rounded-[10px] border-[0.5px] border-kink-bronze px-3 py-3 lg:gap-3">
      <span className="shrink-0 text-kink-gold-bright [&>svg]:size-6 lg:[&>svg]:size-8">
        <ShieldCheckIcon />
      </span>
      <p className="text-[13px] font-medium text-white lg:text-[20px]">
        <span className="text-kink-gold-bright">{lead}</span> {rest}
      </p>
    </div>
  );
}
