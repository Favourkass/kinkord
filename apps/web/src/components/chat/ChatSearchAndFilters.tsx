import { Mail, MessageSquare, Search, SlidersHorizontal, Star, Users } from "lucide-react";
import type { ChatFilter } from "@/domain/chat";

export interface ChatSearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  onFilterToggle?: () => void;
  searchPlaceholder?: string;
}

export default function ChatSearchAndFilters({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onFilterToggle,
  searchPlaceholder = "Search messages or users",
}: ChatSearchAndFiltersProps) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-3">
      {/* Search Bar */}
      <div className="relative flex h-[44px] items-center rounded-2xl bg-[#141417] px-3.5 border border-white/5 focus-within:border-kink-gold-bright/50 transition-colors">
        <Search className="size-4.5 text-[#8e8e93] shrink-0 mr-2.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-[14px] text-white placeholder-[#8e8e93] outline-none"
        />
        <button
          type="button"
          onClick={onFilterToggle}
          aria-label="Filter options"
          className="ml-2 grid size-7 place-items-center text-[#8e8e93] hover:text-white transition"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`flex h-[34px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition shrink-0 ${
            activeFilter === "all"
              ? "bg-[#2c2c2e] text-white border border-white/20"
              : "bg-[#141417] text-[#8e8e93] border border-white/5 hover:text-white"
          }`}
        >
          <MessageSquare className="size-3.5 fill-current" />
          <span>All</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange("unread")}
          className={`flex h-[34px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition shrink-0 ${
            activeFilter === "unread"
              ? "bg-[#2c2c2e] text-white border border-white/20"
              : "bg-[#141417] text-[#8e8e93] border border-white/5 hover:text-white"
          }`}
        >
          <Mail className="size-3.5" />
          <span>Unread</span>
          <span className="size-1.5 rounded-full bg-kink-gold-bright ml-0.5" />
        </button>

        <button
          type="button"
          onClick={() => onFilterChange("groups")}
          className={`flex h-[34px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition shrink-0 ${
            activeFilter === "groups"
              ? "bg-[#2c2c2e] text-white border border-white/20"
              : "bg-[#141417] text-[#8e8e93] border border-white/5 hover:text-white"
          }`}
        >
          <Users className="size-3.5" />
          <span>Groups</span>
        </button>

        <button
          type="button"
          onClick={() => onFilterChange("favorites")}
          className={`flex h-[34px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition shrink-0 ${
            activeFilter === "favorites"
              ? "bg-[#2c2c2e] text-white border border-white/20"
              : "bg-[#141417] text-[#8e8e93] border border-white/5 hover:text-white"
          }`}
        >
          <Star className="size-3.5" />
          <span>Favorites</span>
        </button>
      </div>
    </div>
  );
}
