"use client";
import type { Message } from "../../../lib/types";

export default function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  const t = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {m.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {m.attachments.map((a) =>
              a.mime.startsWith("image/") ? (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.filename}
                    className="max-h-64 rounded-xl border border-slate-200 object-cover"
                  />
                </a>
              ) : (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-indigo-400"
                >
                  📄 <span className="truncate max-w-[180px]">{a.filename}</span>
                </a>
              ),
            )}
          </div>
        )}
        {m.body && (
          <div
            className={`px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
              mine
                ? "bg-indigo-600 text-white rounded-br-md"
                : "bg-white border border-slate-200 rounded-bl-md"
            }`}
          >
            {m.body}
          </div>
        )}
        <div className={`text-[10px] ${mine ? "text-slate-400" : "text-slate-400"}`}>
          {m.pending ? "sending…" : m.failed ? "failed" : t}
        </div>
      </div>
    </div>
  );
}
