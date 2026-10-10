import Link from "next/link";
import { Check } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import VerifiedCheck from "@/components/app/VerifiedCheck";
import SilverCheck from "@/components/app/SilverCheck";
import type { ConversationRowVM } from "@/domain/chat";
import PresenceDot from "./PresenceDot";

export interface ConversationRowProps {
  row: ConversationRowVM;
  onlineLabel: string;
  sentLabel: string;
  unreadLabel: string;
}

export default function ConversationRow({
  row,
  onlineLabel,
  sentLabel,
  unreadLabel,
}: ConversationRowProps) {
  const unread = row.unread > 0;
  return (
    <li>
      <Link
        href={row.href}
        className={`flex items-center gap-[10px] border-b border-app-line/30 px-[10px] py-[10px] transition-colors hover:bg-app-input ${unread ? "rounded-xl bg-app-input/40" : ""}`}
      >
        <span className="relative shrink-0">
          <AvatarCircle src={row.avatarUrl} alt="" size={48} ringClassName="bg-app-line" />
          <PresenceDot
            online={row.isOnline}
            status={row.presence}
            label={row.presenceLabel ?? onlineLabel}
            className="absolute -bottom-[1px] -right-[1px]"
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-[8px]">
            <span className="flex min-w-0 flex-1 items-center gap-[3px]">
              <span className="truncate text-[15px] font-bold text-app-text">
                {row.displayName}
              </span>
              {row.verified && row.verifiedLabel ? (
                <VerifiedCheck label={row.verifiedLabel} />
              ) : null}
              {row.silver ? <SilverCheck size={15} /> : null}
            </span>
            <span className="shrink-0 text-[12px] text-app-muted">{row.time}</span>
          </span>
          <span className="flex items-center gap-[8px] pt-[2px]">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${
                row.typing
                  ? "font-semibold text-app-online"
                  : unread
                    ? "font-semibold text-app-text"
                    : "text-app-muted"
              }`}
            >
              {row.preview}
            </span>
            {unread && (
              <span
                aria-label={`${row.unread} ${unreadLabel}`}
                className="grid min-w-[20px] h-[20px] px-[4px] shrink-0 place-items-center rounded-full bg-kink-gold-bright text-[11px] font-bold text-kink-ink"
              >
                {row.unread > 99 ? "99+" : row.unread}
              </span>
            )}
            {!unread && row.sentByMe && (
              <Check size={16} className="shrink-0 text-kink-gold-bright" aria-label={sentLabel} />
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
