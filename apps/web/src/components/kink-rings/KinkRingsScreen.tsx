"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Clock3,
  Gift,
  Info,
  Send,
  ShoppingCart,
  X,
  Plus,
  Minus,
  MapPin,
  Check,
  Search,
  CalendarDays,
  UserRoundPlus,
  MessageCircle,
} from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { KinkRingsScreenVM } from "@/presenters/useKinkRingsPresenter";
import type { RingItemVM } from "@/domain/kinkRings";

export interface KinkRingsScreenProps extends Omit<KinkRingsScreenVM, "hero"> {
  hero: string;
}
const gold =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#ffe59b]/80 bg-gradient-to-b from-[#ffdc62] via-[#ffc020] to-[#efa600] px-4 py-3 text-sm font-bold text-black shadow-[0_2px_14px_#f6b90025] hover:brightness-110 disabled:opacity-40 disabled:shadow-none";
const panel =
  "rounded-2xl border border-[#8c702e]/50 bg-gradient-to-br from-[#221d10] via-[#0c0c0a] to-[#080808]";
function RingsIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <ellipse
        cx="14"
        cy="25"
        rx="8"
        ry="12"
        transform="rotate(25 14 25)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <ellipse
        cx="25"
        cy="16"
        rx="8"
        ry="12"
        transform="rotate(25 25 16)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M22 6c8 4 7 17-1 22M11 15c8 4 7 17-1 22" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function RingCard({
  ring,
  p,
  expired = false,
}: {
  ring: RingItemVM & { selected?: boolean };
  p: KinkRingsScreenProps;
  expired?: boolean;
}) {
  return (
    <article className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-[#0b0b0b] p-3 sm:flex-nowrap">
      {!expired && p.multiple && (
        <input
          type="checkbox"
          aria-label={`Select ${ring.code}`}
          checked={Boolean(ring.selected)}
          onChange={() => p.onSelect(ring.id)}
          className="size-5 shrink-0 accent-[#ffc020]"
        />
      )}
      <button
        onClick={() => p.onDetail(ring.id)}
        aria-label={`${p.copy.details}: ${ring.code}`}
        className="relative size-14 shrink-0 overflow-hidden rounded-lg sm:size-16"
      >
        <Image src={p.hero} alt="" fill sizes="64px" className="scale-150 object-cover" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => p.onDetail(ring.id)}
            className="truncate text-sm font-bold sm:text-base"
          >
            {ring.code}
          </button>
          <button
            onClick={() => void p.onCopy(ring.id)}
            aria-label={`${p.copy.copy}: ${ring.code}`}
            className="p-2 text-white/60"
          >
            <Copy size={14} />
          </button>
        </div>
        <p className="flex items-center gap-1 text-[10px] text-white/65 sm:text-xs">
          <CalendarDays size={12} className="shrink-0 text-kink-gold-bright" />
          {ring.received}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-white/65 sm:text-xs">
          <CalendarDays size={12} className="shrink-0 text-kink-gold-bright" />
          {ring.expires}
        </p>
        <p
          className={`mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] ${ring.urgent ? "border-red-600/50 bg-red-950/40 text-red-300" : "border-[#8c702e]/40 text-[#e5cc85]"}`}
        >
          <Clock3 size={12} />
          {ring.remaining}
          {ring.urgent ? ` · ${p.copy.expirySoon}` : ""}
        </p>
      </div>
      {!expired && (
        <button
          disabled={p.busy}
          onClick={() => p.onGiftRing(ring.id)}
          className={`${gold} min-h-10 px-2 py-2 text-xs sm:px-3`}
        >
          <Send size={16} />
          {p.copy.giftRing}
        </button>
      )}
    </article>
  );
}
function RecipientIdentity({
  member,
  large = false,
}: {
  member: KinkRingsScreenProps["picked"][number];
  large?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="relative shrink-0">
        <AvatarCircle
          src={member.avatarUrl}
          alt=""
          size={large ? 58 : 48}
          ringClassName="bg-[#bc9336]"
        />
        {member.online && (
          <span
            aria-label="Online"
            className="absolute right-0 top-0 size-3 rounded-full border-2 border-black bg-green-400"
          />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-bold">{member.name}</p>
        <p className="truncate text-xs text-white/55">{member.handle}</p>
        {member.location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-white/65">
            <MapPin size={13} className="shrink-0 text-kink-gold-bright" />
            {member.location}
          </p>
        )}
      </div>
    </div>
  );
}
export default function KinkRingsScreen(p: KinkRingsScreenProps) {
  const c = p.copy;
  const gifting = ["recipients", "selected", "allocation", "message", "review"].includes(p.stage);
  const heading =
    p.stage === "recipients"
      ? c.recipients
      : p.stage === "selected"
        ? c.selected
        : p.stage === "allocation"
          ? c.allocation
          : p.stage === "message"
            ? c.messages
            : c.review;
  const intro =
    p.stage === "recipients"
      ? "Select who will receive your Kink Rings."
      : p.stage === "selected"
        ? c.selectedIntro
        : p.stage === "allocation"
          ? c.allocationIntro
          : p.stage === "message"
            ? c.messageIntro
            : c.reviewIntro;
  return (
    <section className="mx-auto min-h-dvh w-full max-w-[720px] bg-black pb-8 text-white">
      <header className="relative z-10 flex items-center gap-2 px-4 pt-5">
        <button
          onClick={p.onBack}
          disabled={p.busy}
          aria-label={c.back}
          className="rounded-full border border-[#8c702e]/50 bg-[#16130a] p-2.5 text-kink-gold-bright"
        >
          <ArrowLeft size={22} />
        </button>
        {!gifting && (
          <h1 className="flex-1 text-center text-3xl font-extrabold tracking-tight text-[#ffd45a] sm:text-4xl">
            {p.stage === "history" ? c.history : c.title}
          </h1>
        )}
        {gifting && <span className="flex-1" />}
        <button onClick={p.onInfo} aria-label={c.info} className="p-2 text-white/70">
          <Info size={22} />
        </button>
      </header>
      {gifting ? (
        <div className={`relative mx-4 mt-4 ${p.stage === "review" ? "min-h-40 pt-10" : ""}`}>
          {p.stage === "review" && (
            <div className="absolute -right-4 -top-10 h-56 w-[80%]">
              <Image
                src={p.giftHero}
                alt="Gold rings in a gift box"
                fill
                sizes="500px"
                className="object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent" />
            </div>
          )}
          <div className="relative flex items-start gap-2">
            {p.stage !== "review" && (
              <div className="relative mt-3 size-16 shrink-0 overflow-hidden rounded-lg">
                <Image src={p.hero} alt="" fill sizes="80px" className="scale-[1.6] object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-sm text-kink-gold-bright">{c.gifting}</p>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{heading}</h1>
              <p className="mt-2 text-sm leading-5 text-white/65">{intro}</p>
            </div>
            {p.stage !== "review" && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-[#a57a12]/50 bg-[#141005] p-2 text-kink-gold-bright">
                <strong className="text-2xl">{p.selectedCount}</strong>
                <span className="text-[10px] leading-3">
                  Rings
                  <br />
                  Selected
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="relative z-10 mt-2 px-5 text-center text-sm text-white/75 sm:text-base">
          {c.subtitle}
        </p>
      )}
      {p.info && (
        <aside className={`${panel} mx-4 mt-4 p-4 text-sm leading-6`}>
          <div className="mb-2 flex justify-between font-bold text-kink-gold-bright">
            {c.info}
            <button onClick={p.onInfo} aria-label={c.close}>
              <X size={20} />
            </button>
          </div>
          {c.infoText}
        </aside>
      )}
      {p.note && (
        <div
          role="status"
          className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-kink-gold-bright/40 p-3 text-sm text-kink-gold-bright"
        >
          {p.note}
          <button onClick={p.onDismissNote} aria-label={c.dismiss}>
            <X size={18} />
          </button>
        </div>
      )}
      {p.error && (
        <div role="alert" className="m-4 rounded-xl border border-red-400/40 p-4 text-sm">
          {p.error}
          <button onClick={() => void p.onRetry()} className="ml-3 text-kink-gold-bright underline">
            {c.retry}
          </button>
        </div>
      )}
      {p.loading && (
        <p role="status" className="p-8 text-center text-white/60">
          {c.loading}
        </p>
      )}
      {!p.loading && (p.stage === "overview" || p.stage === "inventory") && (
        <>
          <div
            className={`relative ${p.stage === "overview" ? "-mt-2 aspect-[3/2]" : "mt-4 h-40 sm:h-56"}`}
          >
            <Image
              src={p.hero}
              alt="Gold heart ring floating over a glowing pedestal"
              fill
              priority
              sizes="(max-width: 720px) 100vw, 720px"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" />
          </div>
          <button
            onClick={p.onInventory}
            className={`${panel} relative mx-auto -mt-9 flex w-[70%] items-center justify-center gap-3 border-[#d6ad49] px-4 py-3 shadow-[0_0_24px_#db990014]`}
            aria-label={`${p.count} ${p.count === 1 ? c.singleAvailable : c.available}`}
          >
            <span className="text-kink-gold-bright">
              <RingsIcon size={44} />
            </span>
            <span className="text-left">
              <strong className="block text-4xl font-bold text-[#ffd154]">{p.count}</strong>
              <span className="text-xs sm:text-base">
                {p.count === 1 ? c.singleAvailable : c.available}
              </span>
            </span>
            <ChevronRight size={18} className="text-kink-gold-bright" />
          </button>
        </>
      )}
      <div className="px-4">
        {!p.loading && p.stage === "overview" && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={!p.count} onClick={p.onGift} className={gold}>
                <Send size={22} />
                {c.gift}
              </button>
              <Link
                href={p.buyHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d2a83d] bg-[#0c0b07] px-3 py-3 text-sm font-bold shadow-[inset_0_1px_10px_#faca3620]"
              >
                <ShoppingCart size={23} className="text-kink-gold-bright" />
                {c.buy}
              </Link>
            </div>
            {!p.count && <p className="mt-3 text-sm leading-6 text-white/60">{c.noRings}</p>}
            <div className="mb-4 mt-6 flex items-center justify-between border-t border-[#8c702e]/40 pt-5">
              <h2 className="text-xl font-bold">{c.history}</h2>
              <button
                onClick={p.onHistory}
                className="flex items-center gap-1 text-sm font-semibold text-kink-gold-bright"
              >
                {c.viewAll}
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}
        {(p.stage === "overview" || p.stage === "history") && (
          <div className="mt-4 space-y-3">
            {(p.stage === "overview" ? p.history.slice(0, 3) : p.history).map((g) => (
              <article key={g.id} className={`${panel} flex items-center gap-3 p-3`}>
                <AvatarCircle
                  src={g.avatarUrl}
                  alt=""
                  size={48}
                  ringClassName="bg-kink-gold-bright"
                />
                <div className="min-w-0 flex-1">
                  {g.href ? (
                    <Link href={g.href} className="block truncate font-bold">
                      {g.handle ?? g.name}
                    </Link>
                  ) : (
                    <p className="truncate font-bold">{g.name}</p>
                  )}
                  <p className="truncate text-xs text-white/60">{g.name}</p>
                  <p className="mt-1 text-xs text-white/50">{g.date}</p>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-semibold ${g.active ? "border-green-500/50 bg-green-950/50 text-green-400" : "border-white/25 bg-white/5 text-white/60"}`}
                >
                  <span
                    className={`size-2 rounded-full ${g.active ? "bg-green-400 shadow-[0_0_10px_#4ade80]" : "bg-white/40"}`}
                  />
                  {g.status}
                </span>
                {g.href && (
                  <Link href={g.href} aria-label={g.name} className="text-white/50">
                    <ChevronRight size={18} />
                  </Link>
                )}
              </article>
            ))}
            {!p.history.length && !p.loading && (
              <p className={`${panel} p-5 text-sm text-white/55`}>{c.noHistory}</p>
            )}
            {p.stage === "history" && p.historyMore && (
              <button
                disabled={p.moreBusy}
                onClick={p.onMoreHistory}
                className="w-full py-3 text-kink-gold-bright"
              >
                {p.moreBusy ? c.loading : c.more}
              </button>
            )}
          </div>
        )}
        {p.stage === "inventory" && (
          <>
            <label className="my-4 flex items-center gap-3 rounded-xl border border-white/20 bg-[#0b0b0b] p-4 text-sm font-semibold">
              <input
                type="checkbox"
                checked={p.multiple}
                onChange={p.onMultiple}
                className="size-5 accent-[#ffc020]"
              />
              {c.multiple}
              <span className="ml-auto text-xs font-normal text-white/50">
                {p.selectedCount} selected
              </span>
            </label>
            <div className="space-y-3">
              {p.rings.map((r) => (
                <RingCard key={r.id} ring={r} p={p} />
              ))}
            </div>
            {!p.rings.length && <p className="py-6 text-sm text-white/60">{c.noRings}</p>}
            <button
              disabled={!p.selectedCount}
              onClick={p.onGiftSelected}
              className={`${gold} mt-5 w-full`}
            >
              <Gift size={24} />
              Gift Selected Rings ({p.selectedCount})
            </button>
            <button
              onClick={p.onExpand}
              className="mt-5 flex w-full items-center gap-3 rounded-xl border border-white/20 p-4 text-left text-sm font-bold"
            >
              <Clock3 size={23} />
              {c.expired}
              <span className="rounded-full bg-white/10 px-2 py-1">{p.expiredCount}</span>
              <span className="ml-auto text-xs text-kink-gold-bright">{c.viewAll}</span>
              <ChevronDown size={18} />
            </button>
            {p.expanded && (
              <div className="mt-3 space-y-3">
                {p.expired.map((r) => (
                  <RingCard key={r.id} ring={r} p={p} expired />
                ))}
                {!p.expired.length && <p className="p-4 text-sm text-white/50">{c.noExpired}</p>}
                {p.expiredMore && (
                  <button
                    disabled={p.moreBusy}
                    onClick={p.onMoreExpired}
                    className="w-full p-3 text-kink-gold-bright"
                  >
                    {p.moreBusy ? c.loading : c.more}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {p.stage === "recipients" && (
          <>
            <p className="my-5 text-center text-sm text-white/60">
              {p.selectedCount} rings available to gift · {p.picked.length} recipients selected
            </p>
            <label className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#141414] px-3">
              <Search size={18} className="text-white/45" />
              <input
                type="search"
                aria-label={c.find}
                placeholder={c.searchPlaceholder}
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                maxLength={64}
                className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <div className="my-4 grid grid-cols-2 rounded-xl border border-[#8c702e]/60 p-1">
              {(["friends", "search"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => p.onTab(t)}
                  aria-pressed={p.tab === t}
                  className={`rounded-lg py-2.5 text-sm font-bold ${p.tab === t ? "bg-gradient-to-b from-[#ffda60] to-[#f5ad08] text-black" : "text-white/65"}`}
                >
                  {c[t]}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {p.recipients.map((m) => (
                <button
                  key={m.userId}
                  onClick={() => p.onRecipient(m.userId)}
                  aria-pressed={m.selected}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0c0c0c] p-3 text-left"
                >
                  <span className="relative">
                    <AvatarCircle src={m.avatarUrl} alt="" size={52} />
                    {m.online && (
                      <span
                        aria-label="Online"
                        className="absolute top-0 right-0 size-3 rounded-full border border-black bg-green-400"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{m.handle}</span>
                    <span className="block truncate text-xs text-white/60">{m.name}</span>
                    {m.location && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-white/50">
                        <MapPin size={11} className="shrink-0 text-kink-gold-bright" />
                        {m.location}
                      </span>
                    )}
                  </span>
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border ${m.selected ? "border-kink-gold-bright bg-kink-gold-bright text-black" : "border-white/50"}`}
                  >
                    {m.selected && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
            {p.searchStatus && (
              <p role="status" className="my-5 text-center text-sm text-white/55">
                {p.searchStatus}
              </p>
            )}
            {p.searchFailed && (
              <button
                onClick={p.onRetryRecipients}
                className="w-full p-3 text-sm text-kink-gold-bright underline"
              >
                {c.retry}
              </button>
            )}
            {p.recipientsMore && (
              <button
                onClick={p.onMoreRecipients}
                className="w-full p-3 text-sm text-kink-gold-bright"
              >
                {c.more}
              </button>
            )}
            <button
              onClick={p.onContinue}
              disabled={!p.canContinue}
              className={`${gold} mt-5 w-full`}
            >
              {c.continue} ({p.picked.length} Recipients)
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {p.stage === "selected" && (
          <div className="mt-6">
            <p className="mb-4 text-sm text-white/65">
              You have selected {p.picked.length} recipient{p.picked.length === 1 ? "" : "s"} to
              receive your Kink Rings.
            </p>
            <div className="space-y-3">
              {p.picked.map((m) => (
                <article key={m.userId} className={`${panel} flex items-center gap-3 p-4`}>
                  <RecipientIdentity member={m} large />
                  <button
                    aria-label={`${c.remove}: ${m.name}`}
                    onClick={() => p.onRemove(m.userId)}
                    className="rounded-full bg-white/10 p-1.5 text-white/65"
                  >
                    <X size={22} />
                  </button>
                </article>
              ))}
            </div>
            <button
              onClick={p.onAddMore}
              className="mt-5 flex w-full items-center gap-3 rounded-xl border border-[#b48b25] p-4 font-bold text-kink-gold-bright"
            >
              <UserRoundPlus size={24} />
              {c.addMore}
              <ChevronRight size={18} className="ml-auto" />
            </button>
            <div className="my-5 flex items-start gap-3 rounded-xl border border-white/10 bg-[#0b0b0b] p-4 text-sm leading-6 text-white/60">
              <Info size={22} className="shrink-0 text-kink-gold-bright" />
              <p>
                You can select multiple recipients. Each recipient will receive one or more Kink
                Rings in the next step.
              </p>
            </div>
            <button
              disabled={!p.canContinue}
              onClick={p.onContinue}
              className={`${gold} mt-5 w-full`}
            >
              {c.continue} ({p.picked.length} Recipients)
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        {p.stage === "allocation" && (
          <div className="mt-6">
            <div className="space-y-4">
              {p.picked.map((m) => (
                <article key={m.userId} className={`${panel} p-3 sm:p-4`}>
                  <div className="mb-3 flex items-center gap-3">
                    <RecipientIdentity member={m} large />
                    <button
                      aria-label={`${c.remove}: ${m.name}`}
                      onClick={() => p.onRemove(m.userId)}
                      className="rounded-full bg-white/10 p-1.5 text-white/65"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="border-t border-white/15 pt-3">
                    <p className="mb-2 text-xs text-white/65">Assign Kink Rings</p>
                    <div className="space-y-2">
                      {m.rings.map((ring, slot) => (
                        <div key={slot} className="flex items-center gap-2">
                          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-[#a57a12]/40">
                            <Image
                              src={p.hero}
                              alt=""
                              fill
                              sizes="40px"
                              className="scale-[1.6] object-cover"
                            />
                          </div>
                          <select
                            aria-label={`Ring ${slot + 1} for ${m.name}`}
                            value={ring.id}
                            onChange={(e) => p.onRing(m.userId, slot, e.target.value)}
                            className="h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111] px-2 text-xs text-white"
                          >
                            {p.allocationOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-white/60">
                        {m.quantity} month{m.quantity === 1 ? "" : "s"} of Silver
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={`Fewer rings for ${m.name}`}
                          disabled={m.quantity <= 1}
                          onClick={() => p.onQuantity(m.userId, m.quantity - 1)}
                          className="rounded-xl border border-[#a57a12]/50 p-2.5 text-white/65 disabled:opacity-30"
                        >
                          <Minus size={18} />
                        </button>
                        <strong className="grid size-10 place-items-center rounded-xl border border-[#a57a12] text-lg text-kink-gold-bright">
                          {m.quantity}
                        </strong>
                        <button
                          aria-label={`More rings for ${m.name}`}
                          disabled={p.remaining <= 0}
                          onClick={() => p.onQuantity(m.userId, m.quantity + 1)}
                          className="rounded-xl border border-[#a57a12]/50 p-2.5 text-white/65 disabled:opacity-30"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="my-5 flex items-start gap-3 rounded-xl border border-white/10 bg-[#0b0b0b] p-4 text-xs leading-5 text-white/60">
              <Info size={22} className="shrink-0 text-kink-gold-bright" />
              <p>
                You have {p.selectedCount} rings selected. {c.allocationNote}
              </p>
            </div>
            <button disabled={!p.canContinue} onClick={p.onContinue} className={`${gold} w-full`}>
              {c.toMessage} ({p.picked.length} Recipients)
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        {p.stage === "message" && (
          <div className="mt-6">
            <div className="space-y-4">
              {p.picked.map((m) => (
                <article key={m.userId} className={`${panel} p-4`}>
                  <RecipientIdentity member={m} large />
                  <label className="mt-4 block text-sm text-kink-gold-bright">
                    {c.messageLabel} for {m.name}
                    <textarea
                      aria-label={`Message for ${m.name}`}
                      value={m.message}
                      maxLength={500}
                      onChange={(e) => p.onMessage(m.userId, e.target.value)}
                      placeholder={c.messagePlaceholder}
                      rows={4}
                      className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-black p-3 text-base leading-6 text-white placeholder:text-white/35"
                    />
                  </label>
                  <p className="mt-1 text-right text-xs text-white/40">{m.message.length}/500</p>
                </article>
              ))}
            </div>
            <button
              disabled={!p.canContinue}
              onClick={p.onContinue}
              className={`${gold} mt-5 w-full`}
            >
              {c.reviewButton}
              <ChevronRight size={20} />
            </button>
          </div>
        )}
        {p.stage === "review" && (
          <div className="relative mt-4">
            <div className={`${panel} flex items-center gap-4 p-4`}>
              <Gift size={36} className="text-kink-gold-bright" />
              <div>
                <p className="text-sm text-white/65">You are sending</p>
                <strong className="text-xl text-kink-gold-bright">
                  {p.quantityTotal} Kink Ring{p.quantityTotal === 1 ? "" : "s"}
                </strong>
                <p className="text-sm text-white/65">
                  to {p.picked.length} recipient{p.picked.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="my-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <UserRoundPlus size={22} className="text-kink-gold-bright" />
                Recipients
              </h2>
              <button
                disabled={p.busy}
                onClick={p.onEditRecipients}
                className="rounded-xl border border-[#a57a12] px-3 py-2 text-xs text-kink-gold-bright"
              >
                {c.editRecipients}
              </button>
            </div>
            <div className="space-y-3">
              {p.picked.map((m) => (
                <article
                  key={m.userId}
                  className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-3"
                >
                  <div className="flex flex-wrap gap-3">
                    <RecipientIdentity member={m} />
                    <div className="flex min-w-0 flex-wrap items-center gap-2 border-l border-white/15 pl-3">
                      {m.rings.map((ring) => (
                        <div key={ring.id} className="min-w-0">
                          <p className="text-[10px] text-kink-gold-bright">Kink Ring</p>
                          <p className="text-xs font-bold">{ring.code}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#a57a12]/60 bg-black/50 p-3">
                    <MessageCircle size={18} className="shrink-0 text-kink-gold-bright" />
                    <div className="min-w-0 text-xs">
                      <p className="mb-1 text-kink-gold-bright">{c.messageLabel}:</p>
                      <p className="whitespace-pre-wrap break-words leading-5 text-white/80">
                        {m.message.trim() || c.noMessage}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="my-4 flex items-start gap-3 rounded-xl border border-white/10 bg-[#0b0b0b] p-4 text-xs leading-5 text-white/60">
              <Info size={22} className="shrink-0 text-kink-gold-bright" />
              <div>
                <p>{c.finalNote}</p>
                <p className="mt-2">
                  {p.inventoryRemaining} ring{p.inventoryRemaining === 1 ? "" : "s"} will remain in
                  your inventory.
                </p>
              </div>
            </div>
            <button
              disabled={p.busy || !p.canSubmit}
              onClick={() => void p.onGive()}
              className={`${gold} w-full`}
            >
              <Gift size={24} />
              {p.busy
                ? c.sending
                : `Send ${p.quantityTotal} Kink Ring${p.quantityTotal === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
        {p.giveError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-400/30 p-3 text-sm text-red-300"
          >
            {p.giveError}
          </p>
        )}
        {p.detail && (
          <aside className={`${panel} mt-5 p-4`}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-kink-gold-bright">{c.details}</h2>
              <button onClick={() => p.onDetail(null)} aria-label={c.close}>
                <X size={20} />
              </button>
            </div>
            <p className="mt-3 break-all font-mono text-xs text-white/70">{p.detail.id}</p>
            <p className="mt-2 text-sm">{p.detail.received}</p>
            <p className="mt-1 text-sm">{p.detail.expires}</p>
          </aside>
        )}
      </div>
    </section>
  );
}
