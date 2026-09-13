'use client';
import type { Conversation, User } from '../lib/types';

export default function ConversationList({
  conversations,
  activeId,
  onlineUsers,
  me,
  onSelect,
  onNewDm,
  others,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onlineUsers: Set<string>;
  me: User;
  onSelect: (id: string) => void;
  onNewDm: (userId: string) => void;
  others: User[];
}) {
  const peerOf = (c: Conversation) => c.participants.find((p) => p.id !== me.id) ?? null;

  return (
    <aside className="w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{me.displayName}</div>
            <div className="text-xs text-slate-500">@{me.username}</div>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            online
          </div>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-slate-200">
        <div className="text-xs font-medium text-slate-500 mb-2 px-2">Start a chat</div>
        <div className="flex flex-wrap gap-2">
          {others.map((u) => (
            <button
              key={u.id}
              onClick={() => onNewDm(u.id)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50"
            >
              {u.displayName}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No conversations yet.</div>
        )}
        <ul>
          {conversations.map((c) => {
            const peer = peerOf(c);
            const online = peer ? onlineUsers.has(peer.id) : false;
            const active = c.id === activeId;
            const preview = c.lastMessage?.body ?? (c.lastMessage?.attachments?.length ? '📎 Attachment' : 'No messages yet');
            return (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-slate-100 ${
                    active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                      {peer?.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        online ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title={online ? 'Online' : 'Offline'}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">{peer?.displayName ?? c.title ?? 'Conversation'}</div>
                      {c.unreadCount > 0 && (
                        <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs truncate ${c.unreadCount > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                      {preview}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}