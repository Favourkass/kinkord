"use client";
import { useRef, useState } from "react";

export default function MessageComposer({
  disabled,
  onSend,
  onTyping,
  onAttach,
}: {
  disabled: boolean;
  onSend: (body: string, attachmentIds: string[]) => void;
  onTyping: (typing: boolean) => void;
  onAttach: (files: FileList) => Promise<string[]>;
}) {
  const [text, setText] = useState("");
  const [attIds, setAttIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (disabled || busy) return;
    if (!text.trim() && attIds.length === 0) return;
    const body = text.trim();
    const ids = attIds;
    setText("");
    setAttIds([]);
    onTyping(false);
    onSend(body, ids);
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      {attIds.length > 0 && (
        <div className="text-xs text-slate-500 mb-2">
          {attIds.length} attachment(s) ready to send
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          title="Attach file"
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            setBusy(true);
            try {
              const ids = await onAttach(e.target.files);
              setAttIds((prev) => [...prev, ...ids]);
            } finally {
              setBusy(false);
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
        />
        <textarea
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            onTyping(e.target.value.length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={disabled ? "Select a conversation…" : "Write a message…"}
          className="flex-1 resize-none px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-40"
        />
        <button
          onClick={submit}
          disabled={disabled}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
