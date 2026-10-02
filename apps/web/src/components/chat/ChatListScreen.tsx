import ConversationRow from "./ConversationRow";
import type { ConversationRowVM } from "@/domain/chat";

export interface ChatListScreenProps {
  rows: ConversationRowVM[];
  loading: boolean;
  error: string | null;
  empty: boolean;
  heading: string;
  /** Shown under the heading: the "turn on notifications" card, when it applies. */
  banner?: React.ReactNode;
  loadingText: string;
  emptyTitle: string;
  emptyBody: string;
  onlineLabel: string;
}

export default function ChatListScreen(p: ChatListScreenProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col border-x border-app-line lg:mx-auto lg:max-w-[640px]">
      <h1 className="border-b border-app-line px-[20px] py-[16px] text-[20px] font-bold text-app-text">
        {p.heading}
      </h1>
      {p.banner}
      {p.loading && (
        <p className="px-[20px] py-[40px] text-center text-[14px] text-app-muted">
          {p.loadingText}
        </p>
      )}
      {p.error && !p.loading && (
        <p className="px-[20px] py-[40px] text-center text-[14px] font-semibold text-app-danger">
          {p.error}
        </p>
      )}
      {p.empty && (
        <div className="px-[20px] py-[48px] text-center">
          <p className="text-[16px] font-bold text-app-text">{p.emptyTitle}</p>
          <p className="pt-[6px] text-[14px] text-app-muted">{p.emptyBody}</p>
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {p.rows.map((row) => (
          <ConversationRow key={row.id} row={row} onlineLabel={p.onlineLabel} />
        ))}
      </ul>
    </div>
  );
}
