import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { ConversationRowVM } from "@/domain/chat";
import PresenceDot from "./PresenceDot";

export interface ConversationRowProps {
  row: ConversationRowVM;
  onlineLabel: string;
}

export default function ConversationRow({ row, onlineLabel }: ConversationRowProps) {
  const unread = row.unread > 0;
  return (
    <li>
      <Link
        href={row.href}
        className="flex items-center gap-[12px] px-[20px] py-[12px] transition-colors hover:bg-app-input"
      >
        <span className="relative shrink-0">
          <AvatarCircle src={row.avatarUrl} alt="" size={48} ringClassName="bg-app-line" />
          <PresenceDot
            online={row.isOnline}
            label={onlineLabel}
            className="absolute -bottom-[1px] -right-[1px]"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-[8px]">
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-app-text">
              {row.displayName}
            </span>
            <span className="shrink-0 text-[12px] text-app-muted">{row.time}</span>
          </span>
          <span className="flex items-center gap-[8px] pt-[2px]">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${
                unread ? "font-semibold text-app-text" : "text-app-muted"
              }`}
            >
              {row.preview}
            </span>
            {unread && (
              <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-kink-gold-bright text-[11px] font-bold text-kink-ink">
                {row.unread > 9 ? "9+" : row.unread}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
