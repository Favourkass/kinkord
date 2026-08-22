"use client";

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import TextField from "@/components/auth/TextField";
import GoldCta from "@/components/auth/GoldCta";
import UploadTile from "@/components/auth/UploadTile";
import CodeInput from "@/components/auth/CodeInput";
import { useProfilePresenter, useSecurityPresenter } from "@/presenters/useProfilePresenter";

export default function ProfilePage() {
  const p = useProfilePresenter();
  const [twoFactorOn, setTwoFactorOn] = useState<boolean | null>(null);
  const sec = useSecurityPresenter((enabled) => setTwoFactorOn(enabled));
  const [pw, setPw] = useState({ current: "", next: "" });
  const [enablePw, setEnablePw] = useState("");

  if (p.loading) {
    return (
      <AuthShell>
        <p className="mt-20 text-kink-dim">Loading your profile…</p>
      </AuthShell>
    );
  }
  if (!p.me || !p.profile) {
    return (
      <AuthShell>
        <p className="mt-20 text-red-400">{p.error ?? "Could not load your profile."}</p>
      </AuthShell>
    );
  }

  const is2faOn = twoFactorOn ?? p.me.twoFactorEnabled;

  return (
    <AuthShell>
      <div className="w-full max-w-[860px] flex flex-col gap-10">
        {/* Identity header */}
        <section className="rounded-2xl border border-kink-line bg-kink-surface overflow-hidden">
          <div className="h-36 bg-kink-panel relative">
            {p.profile.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
              <img src={p.profile.coverUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="px-6 pb-6 flex items-end gap-5">
            <div className="-mt-12 h-24 w-24 rounded-full border-4 border-kink-surface bg-kink-panel overflow-hidden shrink-0 relative z-10">
              {p.profile.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
                <img src={p.profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="pb-1 min-w-0">
              <p className="text-[22px] font-extrabold text-kink-cream truncate">
                {p.profile.displayName}
              </p>
              <p className="text-[14px] text-kink-dim truncate">
                @{p.me.username ?? "—"} · {p.me.email}{" "}
                {p.me.emailVerified ? (
                  <span className="text-kink-gold">✓ verified</span>
                ) : (
                  <span className="text-kink-faint">(email unverified — check your inbox)</span>
                )}
              </p>
              {p.profile.roles.length > 0 && (
                <p className="mt-1 text-[13px] text-kink-gold truncate">
                  {p.profile.roles.join(" · ")}
                </p>
              )}
            </div>
            <button
              onClick={p.signOut}
              className="ml-auto shrink-0 rounded-lg border border-kink-line px-3 py-1.5 text-[13px] text-kink-dim hover:text-kink-cream hover:border-kink-gold/50"
            >
              Sign out
            </button>
          </div>
        </section>

        {/* Edit profile (feature 005) */}
        <section className="flex flex-col gap-5">
          <h2 className="text-[20px] font-extrabold uppercase tracking-wide text-kink-cream">
            Edit <span className="text-kink-gold">Profile</span>
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Display name"
              value={p.edit.displayName}
              onChange={(v) => p.setEdit({ ...p.edit, displayName: v })}
            />
            <TextField
              label="Pronouns"
              placeholder="e.g. they/them"
              value={p.edit.pronouns}
              onChange={(v) => p.setEdit({ ...p.edit, pronouns: v })}
            />
            <TextField
              label="State"
              value={p.edit.state}
              onChange={(v) => p.setEdit({ ...p.edit, state: v })}
            />
            <TextField
              label="City"
              value={p.edit.city}
              onChange={(v) => p.setEdit({ ...p.edit, city: v })}
            />
          </div>
          <div>
            <label className="mb-2 block text-[15px] font-semibold text-kink-cream">Bio</label>
            <textarea
              rows={4}
              maxLength={500}
              value={p.edit.bio}
              onChange={(e) => p.setEdit({ ...p.edit, bio: e.target.value })}
              className="w-full rounded-xl border border-kink-line bg-kink-surface px-4 py-3 text-[16px] text-kink-cream outline-none transition focus:border-kink-gold"
              placeholder="Tell the community about yourself (max 500 characters)"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <UploadTile
              shape="circle"
              label="Profile photo"
              maxMb={5}
              previewUrl={p.profile.avatarUrl}
              uploading={p.uploading === "avatar"}
              onFile={(f) => p.uploadImage("avatar", f)}
            />
            <UploadTile
              shape="banner"
              label="Cover picture"
              maxMb={10}
              previewUrl={p.profile.coverUrl}
              uploading={p.uploading === "cover"}
              onFile={(f) => p.uploadImage("cover", f)}
            />
          </div>
          {p.error && <p className="text-[14px] text-red-400">{p.error}</p>}
          {p.notice && <p className="text-[14px] text-kink-gold">{p.notice}</p>}
          <GoldCta
            label="Save changes"
            onClick={p.save}
            loading={p.saving}
            className="max-w-[420px] self-start"
          />
        </section>

        {/* Security (feature 006) */}
        <section className="flex flex-col gap-5 border-t border-kink-line pt-8">
          <h2 className="text-[20px] font-extrabold uppercase tracking-wide text-kink-cream">
            Security <span className="text-kink-gold">&amp; 2FA</span>
          </h2>

          <div className="rounded-2xl border border-kink-line bg-kink-surface p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className={is2faOn ? "text-kink-gold" : "text-kink-faint"} />
              <p className="text-[16px] font-semibold text-kink-cream">
                Two-factor authentication:{" "}
                <span className={is2faOn ? "text-kink-gold" : "text-kink-faint"}>
                  {is2faOn ? "ON" : "OFF"}
                </span>
              </p>
            </div>
            <p className="text-[14px] text-kink-dim">
              Works with Google Authenticator, Authy or any authenticator app — free.
            </p>

            {!is2faOn && !sec.setup && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <TextField
                    label="Confirm password to enable"
                    type="password"
                    icon={Lock}
                    autoComplete="current-password"
                    value={enablePw}
                    onChange={setEnablePw}
                  />
                </div>
                <div className="sm:self-end">
                  <GoldCta
                    label="Enable 2FA"
                    arrow={false}
                    loading={sec.busy}
                    onClick={() => void sec.beginEnable(enablePw)}
                    className="sm:w-56"
                  />
                </div>
              </div>
            )}

            {sec.setup && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-kink-amber/50 p-5">
                <p className="text-[15px] text-kink-cream text-center">
                  1. Scan this QR with your authenticator app · 2. Enter the 6-digit code
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- locally generated data URL */}
                <img
                  src={sec.setup.qrDataUrl}
                  alt="2FA QR code"
                  className="rounded-lg bg-white p-2"
                />
                <details className="text-[13px] text-kink-dim">
                  <summary className="cursor-pointer text-kink-gold">
                    Backup codes (save these)
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-1 font-mono">
                    {sec.setup.backupCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </details>
                <CodeInput value={sec.code} onChange={sec.setCode} />
                <GoldCta
                  label="Confirm & turn on"
                  loading={sec.busy}
                  onClick={sec.confirmEnable}
                  className="max-w-[360px]"
                />
              </div>
            )}

            {is2faOn && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <TextField
                    label="Confirm password to disable"
                    type="password"
                    icon={Lock}
                    autoComplete="current-password"
                    value={enablePw}
                    onChange={setEnablePw}
                  />
                </div>
                <div className="sm:self-end">
                  <GoldCta
                    label="Disable 2FA"
                    variant="outline"
                    arrow={false}
                    loading={sec.busy}
                    onClick={() => void sec.disable(enablePw)}
                    className="sm:w-56"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-kink-line bg-kink-surface p-6 flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-kink-cream">Change password</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Current password"
                type="password"
                icon={Lock}
                autoComplete="current-password"
                value={pw.current}
                onChange={(v) => setPw({ ...pw, current: v })}
              />
              <TextField
                label="New password"
                type="password"
                icon={Lock}
                autoComplete="new-password"
                helper="10+ characters, letters & numbers."
                value={pw.next}
                onChange={(v) => setPw({ ...pw, next: v })}
              />
            </div>
            <GoldCta
              label="Change password"
              arrow={false}
              loading={sec.busy}
              onClick={() => void sec.changePassword(pw.current, pw.next)}
              className="max-w-[420px] self-start"
            />
          </div>

          {sec.error && <p className="text-[14px] text-red-400">{sec.error}</p>}
          {sec.notice && <p className="text-[14px] text-kink-gold">{sec.notice}</p>}
        </section>
      </div>
    </AuthShell>
  );
}
