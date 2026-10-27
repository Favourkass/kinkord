"use client";

import Link from "next/link";
import { useId } from "react";
import { Gift } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";

export interface KinkRingsScreenProps {
  title: string;
  intro: string;
  loading: boolean;
  loadingLabel: string;
  error: string | null;
  vm: {
    count: number;
    heading: string;
    rings: Array<{ id: string; expires: string }>;
    given: Array<{ id: string; line: string; href: string | null }>;
  } | null;
  canGive: boolean;
  none: { text: string; action: string; href: string };
  search: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    results: Array<{
      userId: string;
      name: string;
      handle: string | null;
      avatarUrl: string | null;
    }>;
    onPick: (userId: string) => void;
    status: string | null;
  };
  giveLabel: string;
  picked: { name: string; handle: string | null; avatarUrl: string | null } | null;
  confirm: string | null;
  confirmLabel: string;
  cancelLabel: string;
  giving: boolean;
  onGive: () => void;
  onCancel: () => void;
  giveError: string | null;
  note: string | null;
  dismissLabel: string;
  onDismissNote: () => void;
  givenHeading: string;
}

/** Kink Rings: the member's rings, each with its expiry, and giving one to someone. */
export default function KinkRingsScreen(p: KinkRingsScreenProps) {
  // The shell draws the screen twice (phone and desktop): each copy labels its own box.
  const searchId = useId();
  return (
    <section className="mx-auto w-full max-w-[640px] px-5 pb-10 text-white">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-kink-gold-bright">
        <Gift aria-hidden size={24} />
        {p.title}
      </h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-white/65">{p.intro}</p>

      {p.error ? (
        <p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm">
          {p.error}
        </p>
      ) : null}
      {p.loading ? <p role="status">{p.loadingLabel}</p> : null}

      {p.note ? (
        <p
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-kink-gold-bright/40 p-3 text-sm text-kink-gold-bright"
        >
          {p.note}
          <button type="button" onClick={p.onDismissNote} className="text-white/70 underline">
            {p.dismissLabel}
          </button>
        </p>
      ) : null}

      {p.vm ? (
        <>
          <h2 className="text-base font-semibold">{p.vm.heading}</h2>
          {p.vm.rings.length ? (
            <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-kink-gold-bright/25 bg-[#0c0c0c]">
              {p.vm.rings.map((ring) => (
                <li key={ring.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded-full border-[3px] border-kink-gold-bright"
                  />
                  {ring.expires}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-white/65">
              {p.none.text}{" "}
              <Link href={p.none.href} className="font-semibold text-kink-gold-bright underline">
                {p.none.action}
              </Link>
            </p>
          )}

          {p.canGive ? (
            <div className="mt-6">
              <h2 className="text-base font-semibold">{p.giveLabel}</h2>
              {p.picked ? (
                <div className="mt-3 rounded-2xl border border-kink-gold-bright/40 p-4">
                  <div className="flex items-center gap-3">
                    <AvatarCircle src={p.picked.avatarUrl} alt="" size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.picked.name}</p>
                      {p.picked.handle ? (
                        <p className="truncate text-xs text-white/60">{p.picked.handle}</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{p.confirm}</p>
                  {p.giveError ? (
                    <p role="alert" className="mt-2 text-sm text-red-300">
                      {p.giveError}
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={p.onGive}
                      disabled={p.giving}
                      className="h-10 flex-1 rounded-full bg-kink-gold-bright text-sm font-bold text-black disabled:opacity-60"
                    >
                      {p.confirmLabel}
                    </button>
                    <button
                      type="button"
                      onClick={p.onCancel}
                      disabled={p.giving}
                      className="h-10 flex-1 rounded-full border border-white/25 text-sm font-semibold disabled:opacity-60"
                    >
                      {p.cancelLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <label className="block text-sm text-white/65" htmlFor={searchId}>
                    {p.search.label}
                  </label>
                  <input
                    id={searchId}
                    type="search"
                    autoComplete="off"
                    value={p.search.value}
                    placeholder={p.search.placeholder}
                    onChange={(e) => p.search.onChange(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-white/20 bg-black px-4 text-sm text-white placeholder:text-white/40 focus:border-kink-gold-bright focus:outline-none"
                  />
                  {p.search.status ? (
                    <p role="status" className="mt-2 text-sm text-white/60">
                      {p.search.status}
                    </p>
                  ) : null}
                  {p.search.results.length ? (
                    <ul className="mt-2 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/15">
                      {p.search.results.map((m) => (
                        <li key={m.userId}>
                          <button
                            type="button"
                            onClick={() => p.search.onPick(m.userId)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                          >
                            <AvatarCircle src={m.avatarUrl} alt="" size={36} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{m.name}</span>
                              {m.handle ? (
                                <span className="block truncate text-xs text-white/60">
                                  {m.handle}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {p.vm.given.length ? (
            <div className="mt-8">
              <h2 className="text-base font-semibold">{p.givenHeading}</h2>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                {p.vm.given.map((g) => (
                  <li key={g.id}>
                    {g.href ? (
                      <Link href={g.href} className="hover:underline">
                        {g.line}
                      </Link>
                    ) : (
                      g.line
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
