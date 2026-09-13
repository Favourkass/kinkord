'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

export default function UserPicker({ onPick }: { onPick: (u: User) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Uses a throwaway user id to list others, then lets you pick one to "sign in" as.
    api.users('00000000-0000-0000-0000-000000000000')
      .then(setUsers)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-1">Kinkord</h1>
        <p className="text-slate-500 mb-6 text-sm">Pick a user to sign in as (dev only).</p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => onPick(u)}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition"
              >
                <div className="font-medium">{u.displayName}</div>
                <div className="text-xs text-slate-500">@{u.username}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}