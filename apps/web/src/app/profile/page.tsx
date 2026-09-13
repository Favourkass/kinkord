"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import TextField from "@/components/auth/TextField";
import GoldCta from "@/components/auth/GoldCta";
import UploadTile from "@/components/auth/UploadTile";
import { Routes } from "@/constants/Routes";
import { useProfilePresenter } from "@/presenters/useProfilePresenter";

export default function ProfilePage() {
  const p = useProfilePresenter();

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

        {/* Password + 2FA live in Settings → Security & 2FA. */}
        <section className="border-t border-kink-line pt-8">
          <Link
            href={Routes.settingsSecurity}
            className="flex items-center justify-between rounded-2xl border border-kink-line bg-kink-surface p-6 text-[16px] font-semibold text-kink-cream hover:border-kink-gold/50"
          >
            <span className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-kink-gold" />
              Security &amp; 2FA — password and two-factor authentication
            </span>
            <span aria-hidden className="text-kink-gold">
              →
            </span>
          </Link>
        </section>
      </div>
    </AuthShell>
  );
}
