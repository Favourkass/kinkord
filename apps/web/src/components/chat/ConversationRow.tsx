import TeamBadge from "@/components/app/TeamBadge";
import Link from "next/link";
import MessageReceipt from "./MessageReceipt";
import AvatarCircle from "@/components/app/AvatarCircle";
import OrganizationBadge from "@/components/organization/OrganizationBadge";
import type { ConversationRowVM } from "@/domain/chat";
import PresenceDot from "./PresenceDot";

export interface ConversationRowProps {
  row: ConversationRowVM;
  onlineLabel: string;
  sentLabel: string;
  unreadLabel: string;
  organizationLabel: string;
  verifiedOrganizationLabel: string;
}

export default function ConversationRow({
  row,
  onlineLabel,
  unreadLabel,
  organizationLabel,
  verifiedOrganizationLabel,
}: ConversationRowProps) {
  const unread = row.unread > 0;
  return (
    <li>
      <Link
        href={row.href}
        className="flex items-center gap-[13px] px-[16px] py-[13px] transition-colors hover:bg-white/5"
      >
        <span className="relative shrink-0">
          <AvatarCircle
            silver={Boolean(row.silver)}
            src={row.avatarUrl}
            alt=""
            size={54}
            ringClassName="bg-app-line"
            shape={row.organization ? "square" : "circle"}
          />
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
              <span
                className={`truncate text-[16px] font-semibold ${row.organization ? "text-kink-gold-bright" : "text-app-text"}`}
              >
                {row.displayName}
              </span>
              {row.teamMember ? <TeamBadge size={16} /> : null}

              {row.organization ? (
                <OrganizationBadge
                  label={organizationLabel}
                  verified
                  verifiedLabel={verifiedOrganizationLabel}
                  markSize={14}
                />
              ) : null}
            </span>
            <span
              className={`shrink-0 text-[11px] ${unread ? "font-semibold text-kink-gold-bright" : "text-app-muted"}`}
            >
              {row.time}
            </span>
          </span>
          <span className="flex items-center gap-[5px] pt-[5px]">
            {row.sentByMe && !row.typing && <MessageReceipt status={row.receiptStatus ?? "sent"} />}
            <span
              className={`min-w-0 flex-1 truncate text-[14px] ${
                row.typing
                  ? "font-semibold text-app-online"
                  : unread
                    ? "text-app-text"
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
          </span>
        </span>
      </Link>
    </li>
  );
}
