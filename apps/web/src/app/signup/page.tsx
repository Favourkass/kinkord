"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AtSign,
  CheckCircle2,
  ChevronDown,
  Clock,
  Lock,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  User,
  Users,
} from "lucide-react";
import SignupShell from "@/components/auth/SignupShell";
import CountryRow from "@/components/auth/CountryRow";
import CheckRow from "@/components/auth/CheckRow";
import GoldCta from "@/components/auth/GoldCta";
import TextField from "@/components/auth/TextField";
import SelectField from "@/components/auth/SelectField";
import DobPicker from "@/components/auth/DobPicker";
import CodeInput from "@/components/auth/CodeInput";
import UploadTile from "@/components/auth/UploadTile";
import RoleChips from "@/components/auth/RoleChips";
import AgePill from "@/components/ui/AgePill";
import { ShieldCheckIcon } from "@/components/auth/AuthIcons";
import { useSignupWizardPresenter } from "@/presenters/useSignupWizardPresenter";
import {
  KINK_ROLES,
  LAUNCH_COUNTRIES,
  NG_STATES,
  PHONE_COUNTRY_CODES,
} from "@/constants/onboarding";
import { NG_LGAS } from "@/constants/nigeria";
import { Routes } from "@/constants/Routes";

function StageHeading({ plain, highlight }: { plain: string; highlight: string }) {
  return (
    <h1 className="text-center text-[20px] font-bold text-white lg:text-[48px]">
      {plain} <span className="text-kink-gold-bright">{highlight}</span>
    </h1>
  );
}

export default function SignupPage() {
  const p = useSignupWizardPresenter();
  const [rolesOpen, setRolesOpen] = useState(false);

  return (
    <>
      {p.stage === "country" && (
        <SignupShell step={p.step}>
          <section className="flex w-full max-w-[706px] flex-col items-center gap-6 lg:gap-8">
            <div className="text-center">
              <h1 className="text-[21px] font-black text-kink-cream lg:text-[42px]">SELECT</h1>
              <p className="text-[24px] font-black text-kink-gold-bright lg:text-[48px]">
                YOUR COUNTRY
              </p>
              <div className="mx-auto mt-2 h-[2px] w-[132px] bg-[#966400] opacity-50 lg:w-[264px]" />
            </div>
            <div className="flex w-full flex-col gap-4">
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

            <div className="w-full">
              <AgePill lead="18+ Only." rest="You must be 18 or older to join Kinkord." />
            </div>

            <div className="w-full divide-y divide-kink-line rounded-[18px] border border-kink-line bg-kink-surface px-5 sm:px-6">
              <CheckRow
                checked={p.stepOne.ageAttested}
                onChange={p.stepOne.setAgeAttested}
                error={p.stepOne.touched && !p.stepOne.ageAttested}
                trailing={<span className="text-[18px] font-bold text-kink-cream">18+</span>}
              >
                I confirm I am over 18.
              </CheckRow>
              <CheckRow
                checked={p.stepOne.termsAccepted}
                onChange={p.stepOne.setTermsAccepted}
                error={p.stepOne.touched && !p.stepOne.termsAccepted}
                trailing={
                  <span aria-hidden className="text-[20px] text-kink-dim">
                    ▤
                  </span>
                }
              >
                I confirm I have read and understood the{" "}
                <span className="text-kink-gold-bright">
                  Terms and Conditions, Privacy Policy and Community Guidelines.
                </span>
              </CheckRow>
            </div>

            {p.stepOne.touched &&
              (!p.stepOne.country || !p.stepOne.ageAttested || !p.stepOne.termsAccepted) && (
                <p className="text-[13px] text-red-400 lg:text-[15px]">
                  Select your country and confirm both statements to continue.
                </p>
              )}

            <GoldCta label="Continue" onClick={p.stepOne.submit} className="max-w-[564px]" />
            <p className="text-[13px] font-semibold text-kink-dim lg:text-[18px]">
              Already have an account?{" "}
              <Link href={Routes.login} className="font-bold text-kink-gold-bright">
                Log in
              </Link>
            </p>
            <div className="h-[2px] w-[80px] bg-kink-gold-bright lg:w-[160px]" />
          </section>
        </SignupShell>
      )}

      {(p.stage === "account" || p.stage === "about") && (
        <SignupShell step={p.step} badge="STEP 2 OF 4" showTagline={false} onBack={p.backToCountry}>
          <section className="flex w-full max-w-[706px] flex-col items-center gap-6 lg:max-w-[1130px] lg:gap-8">
            <StageHeading plain="CREATE YOUR" highlight="ACCOUNT" />
            <p className="text-center text-[12px] font-black text-[#cccccc] lg:text-[24px] lg:font-bold">
              Let&apos;s start with your account information.
            </p>
            <div className="flex w-full flex-col gap-4 lg:gap-7">
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
                  <span className="flex h-full items-center gap-2">
                    <span aria-hidden className="h-[26px] w-px bg-kink-edge" />
                    <select
                      aria-label="Country code"
                      value={p.accountStep.draft.phoneCountryCode}
                      onChange={(e) =>
                        p.accountStep.set({
                          ...p.accountStep.draft,
                          phoneCountryCode: e.target.value,
                        })
                      }
                      className="bg-transparent text-white outline-none [&>option]:bg-kink-field"
                    >
                      {PHONE_COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.dialCode}>{`${c.flag} ${c.dialCode}`}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} aria-hidden className="-ml-1 text-white" />
                    <span aria-hidden className="h-[26px] w-px bg-kink-edge" />
                  </span>
                }
                value={p.accountStep.draft.phoneLocal}
                onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, phoneLocal: v })}
                error={p.accountStep.errors.phoneLocal}
                helper="This will be used for verification. One number can only be linked to one account."
              />
              <TextField
                label="Password"
                icon={Lock}
                type="password"
                autoComplete="new-password"
                value={p.accountStep.draft.password}
                onChange={(v) => p.accountStep.set({ ...p.accountStep.draft, password: v })}
                error={p.accountStep.errors.password}
                helper="Use 8+ characters with letters & numbers."
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

            <div className="my-2 flex w-full items-center justify-center lg:my-3">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[#faab14]/40 to-transparent" />
            </div>

            <StageHeading plain="TELL US" highlight="ABOUT YOU" />
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:gap-6">
              <SelectField
                label="State"
                icon={MapPin}
                options={NG_STATES}
                placeholder="Select your state"
                value={p.aboutStep.draft.state}
                onChange={(v) => p.aboutStep.set({ ...p.aboutStep.draft, state: v, city: "" })}
                error={p.aboutStep.errors.state}
              />
              <SelectField
                label="LGA / Area"
                icon={MapPin}
                options={NG_LGAS[p.aboutStep.draft.state] ?? []}
                placeholder={
                  p.aboutStep.draft.state ? "Select your area" : "Select your state first"
                }
                value={p.aboutStep.draft.city}
                onChange={(v) => p.aboutStep.set({ ...p.aboutStep.draft, city: v })}
              />
            </div>
            <p className="-mt-3 w-full text-left text-[11px] text-kink-help lg:text-[16px]">
              Your state and area help us show you local communities and events.
            </p>
            <DobPicker
              day={p.aboutStep.draft.dobDay}
              month={p.aboutStep.draft.dobMonth}
              year={p.aboutStep.draft.dobYear}
              onChange={({ day, month, year }) =>
                p.aboutStep.set({
                  ...p.aboutStep.draft,
                  dobDay: day,
                  dobMonth: month,
                  dobYear: year,
                })
              }
              error={p.aboutStep.errors.dob}
            />
            <div className="w-full">
              <p className="mb-2 text-[12px] font-medium text-white lg:text-[20px]">Gender</p>
              <div className="grid grid-cols-2 gap-4 lg:gap-6">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={p.aboutStep.draft.gender === g}
                    onClick={() => p.aboutStep.set({ ...p.aboutStep.draft, gender: g })}
                    className={`flex h-[44px] items-center justify-center gap-2 rounded-[12px] border bg-kink-field text-[15px] capitalize transition lg:h-[56px] lg:text-[17px] ${
                      p.aboutStep.draft.gender === g
                        ? "border-kink-gold-bright font-semibold text-kink-gold-bright"
                        : "border-kink-edge text-kink-cream hover:border-kink-gold-bright/50"
                    }`}
                  >
                    {g === "male" ? "♂" : "♀"} {g}
                  </button>
                ))}
              </div>
              {p.aboutStep.errors.gender && (
                <p className="mt-1.5 text-[11px] text-red-400 lg:text-[14px]">
                  {p.aboutStep.errors.gender}
                </p>
              )}
            </div>
            {p.topError && <p className="text-[13px] text-red-400 lg:text-[15px]">{p.topError}</p>}
            <GoldCta
              label="Send OTP"
              onClick={p.submitCombinedStep}
              loading={p.busy}
              className="max-w-[564px]"
            />
            <div className="text-center text-[11px] text-kink-help lg:text-[16px]">
              <p>We&apos;ll send a 6-digit verification code to your phone.</p>
              <p>One number can only be linked to one Kinkord account.</p>
            </div>
          </section>
        </SignupShell>
      )}

      {p.stage === "verify" && (
        <SignupShell step={p.step} badge="STEP 3 OF 4">
          <section className="flex w-full max-w-[706px] flex-col items-center gap-5 text-center lg:gap-7">
            <StageHeading plain="PHONE" highlight="VERIFICATION" />
            <div className="relative grid h-[92px] w-[84px] place-items-center rounded-t-[16px] rounded-b-[42px] border-[3px] border-kink-gold-bright bg-[#1a1400] lg:h-[130px] lg:w-[118px] lg:rounded-b-[56px]">
              <span className="grid h-[70px] w-[62px] place-items-center rounded-t-[10px] rounded-b-[32px] bg-[#2a2000] lg:h-[102px] lg:w-[90px] lg:rounded-b-[44px]">
                <ShieldCheckIcon className="size-9 text-kink-gold-bright lg:size-12" />
              </span>
            </div>
            <div className="rounded-xl border border-kink-amber/60 bg-kink-surface px-5 py-3">
              <p className="text-[12px] text-kink-cream lg:text-[16px]">
                SMS verification is{" "}
                <span className="font-bold text-kink-gold-bright">coming soon</span>. Skip for now —
                verifying later unlocks the <span className="font-semibold">Basic verified</span>{" "}
                badge.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-[12px] border-2 border-kink-gold-bright bg-[#111111] px-5 py-3 lg:px-8 lg:py-4">
              <Smartphone size={20} className="text-kink-gold-bright lg:size-7" aria-hidden />
              <span className="text-[15px] font-medium text-white lg:text-[24px]">
                {p.accountStep.draft.phoneCountryCode}{" "}
                {p.accountStep.draft.phoneLocal.replace(/^0/, "") || "your phone number"}
              </span>
            </div>
            <CodeInput value="" onChange={() => {}} disabled label="Enter the 6-digit code" />
            <div className="flex items-center gap-2 text-[13px] text-white/60 lg:text-[18px]">
              <Clock size={16} aria-hidden />
              <span>
                Resend code in <span className="font-semibold text-kink-gold-bright/60">--:--</span>
              </span>
            </div>
            <p className="text-[12px] text-kink-help lg:text-[15px]">
              We also sent a confirmation{" "}
              <span className="text-kink-gold-bright">link to your email</span> — click it whenever
              convenient.
            </p>
            <GoldCta label="Skip for now" onClick={p.verifyStep.skip} className="max-w-[564px]" />
          </section>
        </SignupShell>
      )}

      {p.stage === "profile" && (
        <SignupShell step={p.step} badge="STEP 4 OF 4">
          <section className="flex w-full max-w-[706px] flex-col items-center gap-6 lg:max-w-[1130px] lg:gap-8">
            <StageHeading plain="BUILD YOUR" highlight="PROFILE" />
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
              <button
                type="button"
                aria-expanded={rolesOpen}
                onClick={() => setRolesOpen((v) => !v)}
                className="flex h-[52px] w-full items-center gap-4 rounded-[12px] border border-kink-edge bg-kink-field px-5 lg:h-[59px]"
              >
                <Users size={20} className="text-white" aria-hidden />
                <span className="flex-1 text-left text-[15px] font-medium text-white lg:text-[20px]">
                  Roles
                  {p.profileStep.roles.length > 0 && (
                    <span className="ml-2 text-[12px] text-kink-gold-bright lg:text-[15px]">
                      {p.profileStep.roles.length} selected
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden
                  className={`text-kink-help transition-transform ${rolesOpen ? "rotate-180" : ""}`}
                />
              </button>
              {rolesOpen && (
                <div className="mt-3">
                  <RoleChips
                    options={KINK_ROLES}
                    selected={p.profileStep.roles}
                    onToggle={p.profileStep.toggleRole}
                  />
                </div>
              )}
            </div>
            <div className="w-full space-y-1">
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
            {p.profileStep.error && (
              <p className="text-[13px] text-red-400 lg:text-[15px]">{p.profileStep.error}</p>
            )}
            <GoldCta
              label="Complete profile"
              arrow={false}
              onClick={p.profileStep.submit}
              loading={p.busy}
            />
            <p className="flex items-center gap-2 text-[11px] text-kink-help lg:text-[16px]">
              <Lock size={14} aria-hidden />
              Your information is private and secure.
            </p>
          </section>
        </SignupShell>
      )}

      {p.stage === "welcome" && (
        <SignupShell step={p.step}>
          <section className="relative flex w-full max-w-[706px] flex-col items-center gap-6 pb-10 lg:gap-8">
            <h1 className="text-center text-[18px] font-extrabold uppercase text-white lg:text-[36px]">
              🎉 Welcome to Kinkord 🎉
            </h1>

            <div className="w-full rounded-[16px] border-2 border-[#4d8c3b] bg-[#161613] p-5 lg:p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-[54px] shrink-0 place-items-center rounded-full border-2 border-[#59b240] text-[#59b240] lg:size-[74px]">
                  <User size={30} aria-hidden className="lg:size-10" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#8c8c8c] lg:text-[16px]">
                    Your current verification level
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[26px] font-extrabold text-[#59b240] lg:text-[40px]">
                      BASIC
                    </span>
                    <span className="rounded-full border-2 border-[#59b240] bg-[#173404] px-4 py-1 text-[11px] font-bold uppercase text-[#97c459] lg:text-[15px]">
                      Active
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#bfbfbf] lg:text-[17px]">
                    <CheckCircle2 size={16} className="text-[#59b240]" aria-hidden />
                    Phone verification pending — unlocks when SMS goes live
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full rounded-[16px] border-2 border-kink-gold-bright bg-[#161613] p-5 lg:p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-[54px] shrink-0 place-items-center rounded-full border-2 border-kink-gold-bright text-kink-gold-bright lg:size-[64px]">
                  <ShieldCheckIcon className="size-7 lg:size-9" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[18px] font-extrabold uppercase text-kink-gold-bright lg:text-[26px]">
                    Bronze Verification
                  </p>
                  <p className="text-[12px] text-[#999999] lg:text-[16px]">
                    Verify that you are a real person.
                  </p>
                </div>
              </div>
              <div className="my-4 h-px w-full bg-[#4d4d4d]" />
              <ul className="space-y-3">
                {[
                  ["👤", "Selfie verification"],
                  ["📹", "Video verification"],
                  ["🪪", "Government ID verification"],
                ].map(([emoji, label]) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[8px] border-[1.5px] border-kink-gold-bright bg-[#29210f] text-[16px] lg:size-11 lg:text-[20px]">
                      {emoji}
                    </span>
                    <span className="text-[14px] text-[#d1d1d1] lg:text-[18px]">{label}</span>
                  </li>
                ))}
              </ul>
              <div className="mx-auto mt-5 grid h-[44px] w-full max-w-[380px] place-items-center rounded-[10px] bg-[#2a2a28] text-[14px] font-extrabold uppercase text-[#8a8a85] lg:h-[56px] lg:text-[19px]">
                Unavailable
              </div>
            </div>

            <GoldCta
              label="Continue with Basic"
              variant="outline"
              onClick={p.finish}
              className="max-w-[500px]"
            />
          </section>
        </SignupShell>
      )}
    </>
  );
}
