"use client";

import { FormEvent } from "react";

interface Props {
  username: string;
  password: string;
  error: string;
  loading: boolean;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  submit: (e: FormEvent) => void;
}

export default function AdminLoginView({
  username,
  password,
  error,
  loading,
  setUsername,
  setPassword,
  submit,
}: Props) {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-bold tracking-[0.3em] uppercase gold-gradient mb-1"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            KINKORD
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37]/60">Admin Portal</p>
        </div>

        <div className="border border-[#d4af37]/15 bg-[#0d0d0d] p-8">
          <h2
            className="text-lg font-bold text-[#f5f5f0] mb-6 uppercase tracking-widest text-center"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Admin Login
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#888] mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5f5f0] px-4 py-3 text-sm focus:outline-none focus:border-[#d4af37]/60 transition-colors placeholder:text-[#444]"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#888] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5f5f0] px-4 py-3 text-sm focus:outline-none focus:border-[#d4af37]/60 transition-colors placeholder:text-[#444]"
                placeholder="Enter password"
              />
            </div>

            {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4af37] text-[#0a0a0a] py-3 text-sm font-bold uppercase tracking-widest hover:bg-[#f5e27d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
