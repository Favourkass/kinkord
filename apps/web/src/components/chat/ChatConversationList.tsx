import { Pin, SquarePen } from "lucide-react";
import type { ChatFilter, ConversationVM } from "@/domain/chat";
import ChatConversationItem from "./ChatConversationItem";
import ChatListHeader from "./ChatListHeader";
import ChatSearchAndFilters from "./ChatSearchAndFilters";

export interface ChatConversationListProps {
  conversations: ConversationVM[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  onComposeClick: () => void;
  brand?: string;
}

export default function ChatConversationList({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onComposeClick,
  brand = "KINKORD",
}: ChatConversationListProps) {
  const pinnedConversations = conversations.filter((c) => c.isPinned);
  const regularConversations = conversations.filter((c) => !c.isPinned);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-black text-white select-none">
      {/* Top Header */}
      <ChatListHeader brand={brand} />

      {/* Search and Category Filter Chips */}
      <ChatSearchAndFilters
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />

      {/* Conversations Stream */}
      <div className="flex-1 overflow-y-auto pb-24 divide-y divide-white/[0.04]">
        {/* Pinned Section */}
        {pinnedConversations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-4 pt-2 pb-1 text-[12px] font-medium text-[#8e8e93]">
              <Pin className="size-3.5 fill-current" />
              <span>Pinned</span>
            </div>
            {pinnedConversations.map((c) => (
              <ChatConversationItem
                key={c.id}
                conversation={c}
                isSelected={c.id === selectedId}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        )}

        {/* Regular Conversations */}
        <div>
          {regularConversations.map((c) => (
            <ChatConversationItem
              key={c.id}
              conversation={c}
              isSelected={c.id === selectedId}
              onClick={() => onSelect(c.id)}
            />
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#8e8e93]">
            <p className="text-[15px] font-medium">No conversations found</p>
            <p className="mt-1 text-[13px]">
              {searchQuery
                ? "Try a different search term."
                : "Start a new chat using the button below."}
            </p>
          </div>
        )}
      </div>

      {/* Floating Compose Button (FAB) */}
      <button
        type="button"
        onClick={onComposeClick}
        aria-label="New Message"
        className="absolute bottom-6 right-5 z-10 grid size-13 place-items-center rounded-2xl bg-kink-gold-bright text-black shadow-lg shadow-kink-gold-bright/20 hover:brightness-110 active:scale-95 transition"
      >
        <SquarePen className="size-6" />
      </button>
    </div>
  );
}
