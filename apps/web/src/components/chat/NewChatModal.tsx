import { useState } from "react";
import Image from "next/image";
import { Search, UserPlus, X } from "lucide-react";

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (member: { name: string; username?: string; avatarUrl?: string | null }) => void;
}

const SUGGESTED_MEMBERS = [
  {
    name: "Rosabel",
    username: "rosabel",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
    role: "Submissive",
  },
  {
    name: "David",
    username: "david",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
    role: "Dominant",
  },
  {
    name: "Jessica",
    username: "jessica",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
    role: "Switch",
  },
  {
    name: "Mark Daniel",
    username: "markdaniel",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
    role: "Dominant",
  },
  {
    name: "Sophie",
    username: "sophie",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
    role: "Voyeur",
  },
  {
    name: "Chris",
    username: "chris",
    avatarUrl:
      "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&q=80",
    role: "Switch",
  },
];

export default function NewChatModal({ isOpen, onClose, onSelectMember }: NewChatModalProps) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const filtered = SUGGESTED_MEMBERS.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.username.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-[420px] flex-col rounded-3xl bg-[#141417] p-5 text-white border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-kink-gold-bright" />
            <h3 className="text-[17px] font-bold text-white">New Message</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-[#8e8e93] hover:bg-white/10 hover:text-white transition"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative flex h-[42px] items-center rounded-2xl bg-[#1c1c20] px-3.5 border border-white/5">
          <Search className="size-4 text-[#8e8e93] mr-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member or username..."
            className="w-full bg-transparent text-[14px] text-white placeholder-[#8e8e93] outline-none"
            autoFocus
          />
        </div>

        {/* Suggested Members List */}
        <div className="mt-3 max-h-[300px] overflow-y-auto space-y-1 divide-y divide-white/[0.04]">
          {filtered.map((member) => (
            <button
              key={member.username}
              type="button"
              onClick={() => onSelectMember(member)}
              className="flex w-full items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] transition text-left"
            >
              <div className="relative size-11 overflow-hidden rounded-full ring-1 ring-white/10 shrink-0">
                <Image
                  src={member.avatarUrl}
                  alt={member.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[15px] font-semibold text-white truncate">{member.name}</span>
                <span className="text-[12px] text-[#8e8e93] truncate">
                  @{member.username} • {member.role}
                </span>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-[#8e8e93]">
              No members found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
