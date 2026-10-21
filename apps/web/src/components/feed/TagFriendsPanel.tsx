"use client";

import { X } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { TagPickerVM } from "@/presenters/useTagPicker";

export interface TagFriendsLabels {
  button: string;
  title: string;
  search: string;
  loading: string;
  empty: string;
  full: string;
  done: string;
  /** "with" before the tagged names. */
  with: string;
  remove: (name: string) => string;
}

/** Who's tagged so far, under the draft: "with Ada ×, Kemi ×". */
export function TagChips({ tags, labels }: { tags: TagPickerVM; labels: TagFriendsLabels }) {
  if (!tags.chips.length) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#a3a3a3]">
      <span>{labels.with}</span>
      {tags.chips.map((chip) => (
        <span
          key={chip.userId}
          className="inline-flex items-center gap-1 rounded-full border border-kink-gold-bright/40 bg-kink-gold-bright/10 py-1 pr-1 pl-3 font-semibold text-kink-gold-bright"
        >
          {chip.name}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={labels.remove(chip.name)}
            className="grid size-6 place-items-center rounded-full hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </span>
      ))}
    </p>
  );
}

/** Search the author's friends and pick who to tag; sits above the composer's toolbar. */
export default function TagFriendsPanel({
  tags,
  labels,
  id,
}: {
  tags: TagPickerVM;
  labels: TagFriendsLabels;
  id: string;
}) {
  if (!tags.open) return null;
  return (
    <div
      id={id}
      role="group"
      aria-label={labels.title}
      className="mb-2 flex max-h-[260px] flex-col gap-2 rounded-xl border border-white/15 bg-[#171717] p-2"
    >
      <div className="flex items-center gap-2">
        <input
          value={tags.query}
          onChange={(e) => tags.setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="min-h-10 flex-1 rounded-lg border border-white/20 bg-black px-3 text-base text-white placeholder:text-[#a3a3a3] focus:border-kink-gold-bright focus:outline-none"
        />
        <button
          type="button"
          onClick={tags.onClose}
          className="min-h-10 rounded-lg px-3 text-sm font-semibold text-kink-gold-bright"
        >
          {labels.done}
        </button>
      </div>
      {tags.full ? <p className="px-1 text-sm text-[#a3a3a3]">{labels.full}</p> : null}
      {tags.loading ? <p className="px-1 text-sm text-[#a3a3a3]">{labels.loading}</p> : null}
      {tags.empty ? <p className="px-1 text-sm text-[#a3a3a3]">{labels.empty}</p> : null}
      {!tags.full && tags.results.length > 0 ? (
        <ul className="flex flex-col overflow-y-auto">
          {tags.results.map((r) => (
            <li key={r.userId}>
              <button
                type="button"
                onClick={r.onPick}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10"
              >
                <AvatarCircle src={r.avatarUrl} alt={r.name} size={32} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-white">{r.name}</span>
                  {r.handle ? (
                    <span className="truncate text-xs text-[#a3a3a3]">{r.handle}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
