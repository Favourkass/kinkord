"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { CHAT_COPY } from "@/constants/chat";
import {
  applyChanges,
  deleteScopes,
  FORWARD_MAX,
  MESSAGE_BODY_MAX,
  messageActions,
  toForwardChatVMs,
  type ChatMessagePM,
  type ConversationSummaryPM,
  type ForwardResultPM,
  type MessageActionKey,
} from "@/domain/chat";
import { ApiError } from "@/services/apiClient";
import { chatService } from "@/services/chat.service";

const copy = CHAT_COPY.message;
/** How long a short confirmation ("Copied") stays up. */
const NOTICE_MS = 2_500;
/** A pause in typing before the forward picker searches. */
const SEARCH_DELAY_MS = 250;

const ACTION_LABEL: Record<MessageActionKey, string> = {
  copy: copy.copy,
  edit: copy.edit,
  forward: copy.forward,
  delete: copy.delete,
};

function failure(e: unknown): string {
  return e instanceof ApiError ? e.message : copy.failed;
}

/**
 * A message's own menu in an open thread: copy, edit, forward and delete.
 * Composed into the thread presenter, which owns the messages; the server
 * decides every action, and the thread shows what it answers.
 */
export function useMessageActions(opts: {
  conversationId: string;
  messages: ChatMessagePM[];
  viewerId: string | null;
  setMessages: Dispatch<SetStateAction<ChatMessagePM[]>>;
  isOrganization?: (userId: string) => boolean;
}) {
  const { conversationId, messages, viewerId, setMessages, isOrganization } = opts;
  // What's open: the menu, the delete choice, the editor, or the forward picker.
  const [menu, setMenu] = useState<{ id: string; keys: MessageActionKey[] } | null>(null);
  const [deleting, setDeleting] = useState<{
    id: string;
    scopes: Array<"everyone" | "me">;
  } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [chats, setChats] = useState<ConversationSummaryPM[] | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [results, setResults] = useState<ForwardResultPM[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const find = useCallback((id: string) => messages.find((m) => m.id === id) ?? null, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The forward picker lists the inbox's chats, or those matching a search.
  useEffect(() => {
    if (!forwarding) return;
    let live = true;
    const timer = setTimeout(
      () => {
        chatService.list({ q: query }).then(
          (rows) => live && setChats(rows),
          (e: unknown) => {
            if (!live) return;
            setChats([]);
            setError(failure(e));
          },
        );
      },
      query.trim() ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [forwarding, query]);

  /** A long press, a right-click or the bubble's arrow: the menu, as of now. */
  const open = useCallback(
    (id: string) => {
      const pm = find(id);
      if (!pm) return;
      setError(null);
      setMenu({ id, keys: messageActions(pm, viewerId, new Date()) });
    },
    [find, viewerId],
  );

  const close = useCallback(() => {
    if (busy) return;
    setMenu(null);
    setDeleting(null);
    setEditing(null);
    setForwarding(null);
    setError(null);
  }, [busy]);

  const select = useCallback(
    (key: MessageActionKey) => {
      const pm = menu ? find(menu.id) : null;
      setMenu(null);
      if (!pm) return;
      if (key === "copy") {
        chatService.copy(pm.body).then(
          () => setNotice(copy.copied),
          (e: unknown) => setNotice(e instanceof Error ? e.message : copy.failed),
        );
      } else if (key === "edit") {
        setEditing({ id: pm.id, text: pm.body });
      } else if (key === "forward") {
        setChats(null);
        setQuery("");
        setChosen([]);
        setResults(null);
        setForwarding(pm.id);
      } else {
        setDeleting({ id: pm.id, scopes: deleteScopes(pm, viewerId, new Date()) });
      }
    },
    [find, menu, viewerId],
  );

  const remove = useCallback(
    async (scope: "me" | "everyone") => {
      if (!deleting) return;
      const { id } = deleting;
      setBusy(true);
      setError(null);
      try {
        const { message } = await chatService.remove(id, scope);
        if (scope === "me") setMessages((m) => m.filter((x) => x.id !== id));
        else if (message) setMessages((m) => applyChanges(m, [message]));
        setDeleting(null);
      } catch (e) {
        setError(failure(e));
      } finally {
        setBusy(false);
      }
    },
    [deleting, setMessages],
  );

  const save = useCallback(
    async (text: string) => {
      if (!editing) return;
      setBusy(true);
      setError(null);
      try {
        const saved = await chatService.edit(editing.id, text.trim());
        setMessages((m) => applyChanges(m, [saved]));
        setEditing(null);
      } catch (e) {
        setError(failure(e));
      } finally {
        setBusy(false);
      }
    },
    [editing, setMessages],
  );

  const toggle = useCallback((id: string) => {
    setResults(null);
    setChosen((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length >= FORWARD_MAX ? c : [...c, id],
    );
  }, []);

  const forward = useCallback(async () => {
    if (!forwarding || chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const out = await chatService.forward(forwarding, chosen);
      // A copy forwarded into this same chat shows at once.
      const here = out.flatMap((r) =>
        r.message && r.conversationId === conversationId ? [r.message] : [],
      );
      if (here.length) setMessages((m) => applyChanges(m, here));
      const sent = out.filter((r) => r.message).length;
      if (sent === out.length) {
        setForwarding(null);
        setNotice(copy.forwardedTo(sent));
      } else {
        // What went is done; the chats that refused stay chosen, each saying why.
        setResults(out);
        setChosen(out.filter((r) => !r.message).map((r) => r.conversationId));
      }
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }, [chosen, conversationId, forwarding, setMessages]);

  const sheet = menu
    ? {
        title: null,
        items: menu.keys.map((key) => ({
          key,
          label: ACTION_LABEL[key],
          danger: key === "delete",
        })),
        cancelLabel: CHAT_COPY.cancel,
        busy: false,
        error: null,
        onSelect: (key: string) => select(key as MessageActionKey),
        onClose: close,
      }
    : deleting
      ? {
          title: copy.deleteTitle,
          items: deleting.scopes.map((scope) => ({
            key: scope,
            label: scope === "everyone" ? copy.deleteForEveryone : copy.deleteForMe,
            danger: true,
          })),
          cancelLabel: CHAT_COPY.cancel,
          busy,
          error,
          onSelect: (scope: string) => void remove(scope as "me" | "everyone"),
          onClose: close,
        }
      : null;

  const editSheet = editing
    ? {
        id: editing.id,
        title: copy.editTitle,
        text: editing.text,
        maxLength: MESSAGE_BODY_MAX,
        saveLabel: busy ? copy.saving : copy.save,
        cancelLabel: CHAT_COPY.cancel,
        busy,
        error,
        onSave: (text: string) => void save(text),
        onClose: close,
      }
    : null;

  const forwardSheet = forwarding
    ? {
        title: copy.forwardTitle,
        searchLabel: copy.forwardSearch,
        query,
        onQuery: setQuery,
        loading: chats === null,
        chats: toForwardChatVMs(chats ?? [], chosen, results, isOrganization),
        emptyText: copy.forwardEmpty,
        chosenLabel: copy.forwardChosen(chosen.length, FORWARD_MAX),
        sentLabel: copy.forwardSent,
        sendLabel: busy ? copy.forwarding : copy.forwardSend,
        canSend: chosen.length > 0 && !busy,
        cancelLabel: CHAT_COPY.cancel,
        error,
        onToggle: toggle,
        onSend: () => void forward(),
        onClose: close,
      }
    : null;

  return { open, sheet, editSheet, forwardSheet, notice };
}
