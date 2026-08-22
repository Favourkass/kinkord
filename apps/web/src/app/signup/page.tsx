"use client";

import Link from "next/link";
import { AtSign, Lock, Mail, MapPin, Phone, User } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import WizardHeading from "@/components/auth/WizardHeading";
import CountryRow from "@/components/auth/CountryRow";
import CheckRow from "@/components/auth/CheckRow";
import GoldCta from "@/components/auth/GoldCta";
import TextField from "@/components/auth/TextField";
import SelectField from "@/components/auth/SelectField";
import DobPicker from "@/components/auth/DobPicker";
import CodeInput from "@/components/auth/CodeInput";
import UploadTile from "@/components/auth/UploadTile";
import RoleChips from "@/components/auth/RoleChips";
import { useSignupWizardPresenter } from "@/presenters/useSignupWizardPresenter";
import {
  KINK_ROLES,
  LAUNCH_COUNTRIES,
  NG_STATES,
  PHONE_COUNTRY_CODES,
} from "@/constants/onboarding";
import { Routes } from "@/constants/Routes";

export default function SignupPage() {
  const p = useSignupWizardPresenter();

  return (
    <AuthShell step={p.step}>
      {p.stage === "country" && (
        <section className="w-full max-w-[800px] flex flex-col items-center gap-8">
          <WizardHeading plain="Select" highlight="Your Country" />
          <div className="w-full flex flex-col gap-4">
            {LAUNCH_COUNTRIES.map((c) => (
              <CountryRow
                key={c.code}
                flag={c.flag}
                name={c.name}
                selected={p.stepOne.country === c.code}
                onSelect={() => p.stepOne.setCountry(c.code)}
              />
            ))}
          </div>

          <div className="w-full rounded-[18px] border border-kink-line bg-kink-surface px-5 sm:px-6 divide-y divide-kink-line">
            <CheckRow
              checked={p.stepOne.ageAttested}
              onChange={p.stepOne.setAgeAttested}
              error={p.stepOne.touched && !p.stepOne.ageAttested}
              trailing={<span className="text-[20px] font-extrabold">18+</span>}
            >
              I confirm I am over 18.
            </CheckRow>
            <CheckRow
              checked={p.stepOne.termsAccepted}
              onChange={p.stepOne.setTermsAccepted}
              error={p.stepOne.touched && !p.stepOne.termsAccepted}
              trailing={
                <span aria-hidden className="text-[20px]">
                  ▤
                </span>
              }
            >
              I confirm I have read and understood the{" "}
              <span className="text-kink-gold">
                Terms and Conditions, Privacy Policy and Community Guidelines.
              </span>
            </CheckRow>
          </div>

          {p.stepOne.touched &&
            (!p.stepOne.country || !p.stepOne.ageAttested || !p.stepOne.termsAccepted) && (
              <p className="text-[14px] text-red-400">
                Select your country and confirm both statements to continue.
              </p>
            )}

          <GoldCta label="Continue" onClick={p.stepOne.submit} className="max-w-[600px]" />
          <p className="text-[15px] text-kink-dim">
            Already have an account?{" "}
            <Link
              href={Routes.login}
              className="font-semibold text-kink-gold underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </section>
      )}

      {p.stage === "account" && (
        <section className="w-full max-w-[760px] flex flex-col items-center gap-7">
          <WizardHeading
            plain="Create Your"
            highlight="Account"
            sub="Let's start with your account information."
          />
          <div className="w-full flex flex-col gap-5">
            <TextField
              label="Username"
              icon={AtSign}
              placeholder="@yourhandle"
              autoComplete="username"
              value={p.accountStep.draft.username}
              onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, username: v })}
              error={p.accountStep.errors.username}
              valid={!!p.accountStep.draft.username && !p.accountStep.errors.username}
              helper="This is your unique username on Kinkord."
            />
            <TextField
              label="Display name"
              icon={User}
              placeholder="How members will see you"
              value={p.accountStep.draft.displayName}
              onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, displayName: v })}
              error={p.accountStep.errors.displayName}
              valid={!!p.accountStep.draft.displayName && !p.accountStep.errors.displayName}
              helper="This is the name other members will see."
            />
            <TextField
              label="Email address"
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={p.accountStep.draft.email}
              onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, email: v })}
              error={p.accountStep.errors.email}
              valid={!!p.accountStep.draft.email && !p.accountStep.errors.email}
              helper="We'll never share your email with anyone."
            />
            <TextField
              label="Phone number"
              icon={Phone}
              placeholder="803 123 4567"
              autoComplete="tel"
              leftAddon={
                <select
                  aria-label="Country code"
                  value={p.accountStep.draft.phoneCountryCode}
                  onChange={(e) =>
                    p.accountStep.set({ ...p.accountStep.draft, phoneCountryCode: e.target.value })
                  }
                  className="bg-transparent text-kink-cream outline-none [&>option]:bg-kink-surface"
                >
                  {PHONE_COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.dialCode}>{`${c.flag} ${c.dialCode}`}</option>
                  ))}
                </select>
              }
              value={p.accountStep.draft.phoneLocal}
              onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, phoneLocal: v })}
              error={p.accountStep.errors.phoneLocal}
              helper="Used for verification once SMS goes live. One number, one account."
            />
            <TextField
              label="Password"
              icon={Lock}
              type="password"
              autoComplete="new-password"
              value={p.accountStep.draft.password}
              onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, password: v })}
              error={p.accountStep.errors.password}
              helper="Use 10+ characters with letters & numbers."
            />
            <TextField
              label="Confirm password"
              icon={Lock}
              type="password"
              autoComplete="new-password"
              value={p.accountStep.draft.confirmPassword}
              onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, confirmPassword: v })}
              error={p.accountStep.errors.confirmPassword}
              helper="Re-enter your password."
            />
          </div>
          <GoldCta label="Next" onClick={p.accountStep.submit} className="max-w-[600px]" />
        </section>
      )}

      {p.stage === "about" && (
        <section className="w-full max-w-[900px] flex flex-col items-center gap-7">
          <WizardHeading plain="Tell Us" highlight="About You" />
          <div className="grid w-full gap-5 sm:grid-cols-2">
            <SelectField
              label="State"
              icon={MapPin}
              options={NG_STATES}
              placeholder="Select your state"
              value={p.aboutStep.draft.state}
              onChange={(v) => p.aboutStep.set({ ...p.aboutStep.draft, state: v })}
              error={p.aboutStep.errors.state}
            />
            <TextField
              label="City"
              icon={MapPin}
              placeholder="e.g. Sapele"
              value={p.aboutStep.draft.city}
              onChange={(v) => p.aboutStep.set({ ...p.aboutStep.draft, city: v })}
              helper="Your state and city help us show you local communities and events."
            />
          </div>
          <DobPicker
            day={p.aboutStep.draft.dobDay}
            month={p.aboutStep.draft.dobMonth}
            year={p.aboutStep.draft.dobYear}
            onChange={({ day, month, year }) =>
              p.aboutStep.set({ ...p.aboutStep.draft, dobDay: day, dobMonth: month, dobYear: year })
            }
            error={p.aboutStep.errors.dob}
          />
          <div className="w-full">
            <p className="mb-2 text-[15px] font-semibold text-kink-cream">Gender</p>
            <div className="grid grid-cols-2 gap-4">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={p.aboutStep.draft.gender === g}
                  onClick={() => p.aboutStep.set({ ...p.aboutStep.draft, gender: g })}
                  className={`rounded-xl border px-4 py-[13px] text-[16px] capitalize transition ${
                    p.aboutStep.draft.gender === g
                      ? "border-kink-gold bg-kink-gold/10 text-kink-gold font-semibold"
                      : "border-kink-line bg-kink-surface text-kink-cream hover:border-kink-gold/50"
                  }`}
                >
                  {g === "male" ? "♂" : "♀"} {g}
                </button>
              ))}
            </div>
            {p.aboutStep.errors.gender && (
              <p className="mt-1.5 text-[13px] text-red-400">{p.aboutStep.errors.gender}</p>
            )}
          </div>
          {p.topError && <p className="text-[14px] text-red-400">{p.topError}</p>}
          <GoldCta
            label="Create account"
            onClick={p.aboutStep.submit}
            loading={p.busy}
            className="max-w-[600px]"
          />
        </section>
      )}

      {p.stage === "verify" && (
        <section className="w-full max-w-[760px] flex flex-col items-center gap-7 text-center">
          <WizardHeading plain="Phone" highlight="Verification" />
          <div className="rounded-2xl border border-kink-amber/60 bg-kink-surface px-6 py-4">
            <p className="text-[15px] text-kink-cream">
              SMS verification is <span className="font-bold text-kink-gold">coming soon</span>. You
              can skip this step for now — your account stays active, and verifying later unlocks
              the <span className="font-semibold">Basic verified</span> badge.
            </p>
          </div>
          <CodeInput value="" onChange={() => {}} disabled label="Enter the 6-digit code" />
          <p className="text-[14px] text-kink-faint">
            We also sent a confirmation <span className="text-kink-gold">link to your email</span> —
            click it whenever convenient.
          </p>
          <GoldCta label="Skip for now" onClick={p.verifyStep.skip} className="max-w-[600px]" />
        </section>
      )}

      {p.stage === "profile" && (
        <section className="w-full max-w-[860px] flex flex-col items-center gap-8">
          <WizardHeading plain="Build Your" highlight="Profile" />
          <UploadTile
            shape="circle"
            label="Profile photo"
            required
            maxMb={5}
            previewUrl={p.profileStep.avatarUrl}
            uploading={p.profileStep.uploading === "avatar"}
            onFile={(f) => p.profileStep.uploadImage("avatar", f)}
          />
          <UploadTile
            shape="banner"
            label="Cover picture"
            required
            maxMb={10}
            previewUrl={p.profileStep.coverUrl}
            uploading={p.profileStep.uploading === "cover"}
            onFile={(f) => p.profileStep.uploadImage("cover", f)}
          />
          <div className="w-full">
            <p className="mb-3 text-[16px] font-semibold text-kink-cream">Roles</p>
            <RoleChips
              options={KINK_ROLES}
              selected={p.profileStep.roles}
              onToggle={p.profileStep.toggleRole}
            />
          </div>
          <div className="w-full rounded-[18px] border border-kink-line bg-kink-surface px-5 divide-y divide-kink-line">
            <CheckRow checked={p.profileStep.noMinors} onChange={p.profileStep.setNoMinors}>
              I confirm that my photographs do not contain minors.
            </CheckRow>
            <CheckRow
              checked={p.profileStep.consentThirdParty}
              onChange={p.profileStep.setConsentThirdParty}
            >
              I confirm that my photographs do not contain third parties without their consent.
            </CheckRow>
          </div>
          {p.profileStep.error && <p className="text-[14px] text-red-400">{p.profileStep.error}</p>}
          <GoldCta
            label="Complete profile"
            onClick={p.profileStep.submit}
            loading={p.busy}
            className="max-w-[600px]"
          />
        </section>
      )}

      {p.stage === "welcome" && (
        <section className="w-full max-w-[760px] flex flex-col items-center gap-7">
          <h2
            className="text-center text-[26px] sm:text-[34px] font-black uppercase tracking-wide text-kink-cream"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            🎉 Welcome to <span className="text-kink-gold">Kinkord</span> 🎉
          </h2>
          <div className="w-full rounded-2xl border border-kink-line bg-kink-surface p-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-kink-dim">
              Your current verification level
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[26px] font-black text-kink-cream">STARTER</span>
              <span className="rounded-md border border-kink-gold/60 px-2 py-0.5 text-[11px] font-bold tracking-widest text-kink-gold">
                ACTIVE
              </span>
            </div>
            <p className="mt-2 text-[14px] text-kink-dim">
              ✉️ Confirm your email via the link we sent. 📱 Phone verification (Basic level)
              unlocks when SMS goes live.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-kink-amber/70 bg-kink-surface p-6">
            <p className="text-[20px] font-extrabold text-kink-gold">BRONZE VERIFICATION</p>
            <p className="mt-1 text-[14px] text-kink-dim">Verify that you are a real person.</p>
            <ul className="mt-4 space-y-2 text-[15px] text-kink-cream/90">
              <li>👤 Selfie verification</li>
              <li>🎥 Video verification</li>
              <li>🪪 Government ID verification</li>
            </ul>
            <div className="mt-5 rounded-xl bg-kink-gold/80 py-3 text-center text-[15px] font-extrabold uppercase tracking-wider text-black opacity-60">
              Unavailable →
            </div>
          </div>
          <GoldCta
            label="Continue with Starter"
            variant="outline"
            onClick={p.finish}
            className="max-w-[600px]"
          />
        </section>
      )}
    </AuthShell>
  );
}
