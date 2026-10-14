"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AtSign, CheckCircle2, ChevronDown, Lock, Mail, MapPin, User, Users } from "lucide-react";
import EditRowsCard from "@/components/profile/edit/EditRowsCard";
import FieldEditorSheet from "@/components/profile/edit/FieldEditorSheet";
import SignupShell from "@/components/auth/SignupShell";
import SelectField from "@/components/auth/SelectField";
import SearchSelectField from "@/components/auth/SearchSelectField";
import CheckRow from "@/components/auth/CheckRow";
import GoldCta from "@/components/auth/GoldCta";
import TextField from "@/components/auth/TextField";
import DobPicker from "@/components/auth/DobPicker";
import CodeInput from "@/components/auth/CodeInput";
import UploadTile from "@/components/auth/UploadTile";
import RoleChips from "@/components/auth/RoleChips";
import PhotoConfirmation from "@/components/profile/PhotoConfirmation";
import AgePill from "@/components/ui/AgePill";
import { ShieldCheckIcon } from "@/components/auth/AuthIcons";
import { useSignupWizardPresenter } from "@/presenters/useSignupWizardPresenter";
import { Routes } from "@/constants/Routes";
import type { SignupField } from "@/domain/onboarding";

const fieldId = (field: SignupField) => `signup-${field}`;

function StageHeading({ plain, highlight }: { plain: string; highlight: string }) {
  return (
    <h1 className="text-center text-[20px] font-bold text-white lg:text-[48px]">
      {plain} <span className="text-kink-gold-bright">{highlight}</span>
    </h1>
  );
}

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupWizard />
    </Suspense>
  );
}

function SignupWizard() {
  // The app sends a member who left sign-up half-done back to the step they owe.
  const resume = useSearchParams().get("resume");
  const p = useSignupWizardPresenter(
    resume === "email" || resume === "preferences" || resume === "profile" ? resume : undefined,
  );
  const [rolesOpen, setRolesOpen] = useState(false);

  // A failed Send OTP says what's wrong by the button; bring the first bad
  // field into view too, since on a phone it's usually scrolled off the top.
  const firstInvalid = p.firstInvalid;
  useEffect(() => {
    if (!firstInvalid) return;
    document
      .getElementById(fieldId(firstInvalid.field))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [firstInvalid]);

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
            <SearchSelectField
              label="Country"
              boldLabel
              value={p.stepOne.country ?? ""}
              onChange={p.stepOne.setCountry}
              options={p.stepOne.options}
              placeholder="Choose your country"
              searchPlaceholder="Search countries"
              emptyLabel="No countries found"
            />

            <div className="w-full">
              <AgePill lead="18+ Only." rest="You must be 18 or older to join Kinkord." />
            </div>

            <div className="w-full divide-y divide-kink-line rounded-[18px] border border-kink-line bg-kink-surface px-5 sm:px-6">
              <CheckRow
                checked={p.stepOne.ageAttested}
                onChange={p.stepOne.setAgeAttested}
                error={p.stepOne.touched && !p.stepOne.ageAttested}
                trailing={
                  <span role="img" aria-label="Adults only" className="text-[24px] leading-none">
                    🔞
                  </span>
                }
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
        <SignupShell step={p.step} badge="STEP 2 OF 5" showTagline={false} onBack={p.backToCountry}>
          <section className="flex w-full max-w-[706px] flex-col items-center gap-6 lg:max-w-[1130px] lg:gap-8">
            <StageHeading plain="CREATE YOUR" highlight="ACCOUNT" />
            <p className="text-center text-[12px] font-black text-[#cccccc] lg:text-[24px] lg:font-bold">
              Let&apos;s start with your account information.
            </p>
            <div className="flex w-full flex-col gap-4 lg:gap-7">
              <TextField
                id={fieldId("username")}
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
                id={fieldId("displayName")}
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
                id={fieldId("email")}
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
                id={fieldId("password")}
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
                id={fieldId("confirmPassword")}
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
              <SearchSelectField
                id={fieldId("state")}
                label={p.aboutStep.location.stateLabel}
                options={p.aboutStep.location.states}
                placeholder={p.aboutStep.location.statePlaceholder}
                searchPlaceholder={p.aboutStep.location.stateSearchPlaceholder}
                emptyLabel="No matching regions"
                value={p.aboutStep.draft.state}
                onChange={p.aboutStep.selectState}
                error={p.aboutStep.errors.state}
              />
              {p.aboutStep.location.areaMode === "select" ? (
                <SearchSelectField
                  label={p.aboutStep.location.areaLabel}
                  options={p.aboutStep.location.areas}
                  placeholder={p.aboutStep.location.areaPlaceholder}
                  searchPlaceholder={p.aboutStep.location.areaSearchPlaceholder}
                  disabled={p.aboutStep.location.areaDisabled}
                  emptyLabel={p.aboutStep.location.areaEmptyLabel}
                  moreLabel={p.aboutStep.location.areaMoreLabel}
                  other={p.aboutStep.location.otherArea}
                  value={p.aboutStep.areaValue}
                  onChange={p.aboutStep.selectArea}
                />
              ) : (
                <TextField
                  label="City / Town (optional)"
                  icon={MapPin}
                  placeholder="Enter your city or town"
                  value={p.aboutStep.draft.city}
                  onChange={(v) => p.aboutStep.set({ ...p.aboutStep.draft, city: v })}
                />
              )}
              {p.aboutStep.location.customArea && (
                <TextField
                  label="Region / City / Town name"
                  icon={MapPin}
                  placeholder="Enter your region, city or town"
                  value={p.aboutStep.draft.city}
                  onChange={(city) => p.aboutStep.set({ ...p.aboutStep.draft, city })}
                />
              )}
            </div>
            <p className="-mt-3 w-full text-left text-[11px] text-kink-help lg:text-[16px]">
              {p.aboutStep.location.helper}
            </p>
            <p className="-mt-5 w-full text-left text-[10px] text-kink-help lg:-mt-7 lg:text-[13px]">
              {p.aboutStep.location.credit.text}{" "}
              <a
                href={p.aboutStep.location.credit.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {p.aboutStep.location.credit.licence}
              </a>
            </p>
            <DobPicker
              id={fieldId("dob")}
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
            <div id={fieldId("gender")} className="w-full">
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
            <SelectField
              label={p.aboutStep.sexuality.label}
              options={p.aboutStep.sexuality.options}
              clearLabel={p.aboutStep.sexuality.clearLabel}
              helper={p.aboutStep.sexuality.helper}
              value={p.aboutStep.draft.orientation ?? ""}
              onChange={(orientation) => p.aboutStep.set({ ...p.aboutStep.draft, orientation })}
            />
            {p.topError && <p className="text-[13px] text-red-400 lg:text-[15px]">{p.topError}</p>}
            <GoldCta
              label="Send OTP"
              onClick={p.submitCombinedStep}
              loading={p.busy}
              className="max-w-[564px]"
            />
            <div className="text-center text-[11px] text-kink-help lg:text-[16px]">
              <p>We&apos;ll send a 6-digit verification code to your email.</p>
            </div>
          </section>
        </SignupShell>
      )}

      {p.stage === "email" && (
        <SignupShell step={p.step} badge={`STEP ${p.step} OF 5`}>
          <section className="flex w-full max-w-[706px] flex-col items-center gap-5 text-center lg:gap-7">
            <StageHeading plain="VERIFY YOUR" highlight="EMAIL" />
            <div className="relative grid h-[92px] w-[84px] place-items-center rounded-t-[16px] rounded-b-[42px] border-[3px] border-kink-gold-bright bg-[#1a1400] lg:h-[130px] lg:w-[118px] lg:rounded-b-[56px]">
              <span className="grid h-[70px] w-[62px] place-items-center rounded-t-[10px] rounded-b-[32px] bg-[#2a2000] lg:h-[102px] lg:w-[90px] lg:rounded-b-[44px]">
                <ShieldCheckIcon className="size-9 text-kink-gold-bright lg:size-12" />
              </span>
            </div>
            <section className="w-full rounded-[16px] border border-kink-amber/60 bg-kink-surface p-5 text-left">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-bold text-white">Email address</p>
                {p.verifyStep.email.verified && (
                  <span className="rounded-full bg-kink-gold-bright px-[10px] py-[3px] text-[11px] font-bold text-black">
                    VERIFIED
                  </span>
                )}
              </div>
              {p.verifyStep.email.verified ? (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <p className="text-[12px] text-kink-cream lg:text-[15px]">
                    Your email address is confirmed.
                  </p>
                  <GoldCta
                    label="Next step"
                    onClick={p.verifyStep.nextStep}
                    className="max-w-[564px]"
                  />
                </div>
              ) : (
                <>
                  <p className="mt-2 text-[12px] text-kink-cream lg:text-[15px]">
                    {p.verifyStep.email.sentTo
                      ? `We emailed a 6-digit code to ${p.verifyStep.email.sentTo}. It expires in 10 minutes.`
                      : "Sending a 6-digit code to your email…"}
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <CodeInput
                      value={p.verifyStep.email.code}
                      onChange={p.verifyStep.email.setCode}
                      disabled={!p.verifyStep.email.sent || p.verifyStep.email.verifying}
                      label="Enter the code from your email"
                    />
                    {p.verifyStep.email.error && (
                      <p className="text-[13px] text-red-400">{p.verifyStep.email.error}</p>
                    )}
                    <GoldCta
                      label="Verify my email"
                      arrow={false}
                      onClick={p.verifyStep.email.verify}
                      loading={p.verifyStep.email.verifying}
                      className="max-w-[564px]"
                    />
                    <button
                      type="button"
                      onClick={p.verifyStep.email.sendCode}
                      disabled={!p.verifyStep.email.canResend}
                      className="text-[12px] text-kink-help underline disabled:opacity-60"
                    >
                      {p.verifyStep.email.resendIn > 0
                        ? `Send a new code in ${String(
                            Math.floor(p.verifyStep.email.resendIn / 60),
                          ).padStart(
                            2,
                            "0",
                          )}:${String(p.verifyStep.email.resendIn % 60).padStart(2, "0")}`
                        : "Send a new code"}
                    </button>
                  </div>
                </>
              )}
            </section>
          </section>
        </SignupShell>
      )}

      {p.stage === "preferences" && (
        <SignupShell step={p.step} badge="STEP 4 OF 5">
          <section className="flex w-full max-w-[706px] flex-col items-center gap-6">
            <StageHeading plain="YOUR" highlight="PREFERENCES" />
            <p className="text-center text-[13px] text-kink-help lg:text-[16px]">
              Choose your kinks, what you’re looking for, and your limits. These are optional and
              can be changed in Edit Profile.
            </p>
            {p.preferencesStep.loading ? (
              <p className="text-kink-help">Loading preferences…</p>
            ) : (
              <EditRowsCard rows={p.preferencesStep.rows} />
            )}
            {p.preferencesStep.error && (
              <div className="text-center">
                <p role="alert" className="text-[13px] text-red-400">
                  {p.preferencesStep.error}
                </p>
                {!p.preferencesStep.canContinue && (
                  <button
                    type="button"
                    onClick={p.preferencesStep.retry}
                    className="mt-2 text-kink-gold-bright underline"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
            <GoldCta
              label="Continue"
              onClick={p.preferencesStep.submit}
              loading={p.busy}
              disabled={!p.preferencesStep.canContinue}
              className="max-w-[564px]"
            />
            {p.preferencesStep.canSkip && (
              <button
                type="button"
                onClick={p.preferencesStep.skip}
                className="text-[14px] font-semibold text-kink-gold-bright underline"
              >
                Skip for now
              </button>
            )}
          </section>
          {p.preferencesStep.editor && <FieldEditorSheet {...p.preferencesStep.editor} />}
        </SignupShell>
      )}

      {p.stage === "profile" && (
        <SignupShell step={p.step} badge={`STEP ${p.step} OF 5`}>
          <section className="flex w-full max-w-[706px] flex-col items-center gap-6 lg:max-w-[1130px] lg:gap-8">
            <StageHeading plain="BUILD YOUR" highlight="PROFILE" />
            {p.profileStep.resumed && (
              <p className="text-center text-[13px] text-kink-cream lg:text-[16px]">
                {p.profileStep.canSkipPhotos
                  ? "Add your photos now, or skip and add them later in Edit Profile."
                  : "Add a profile photo and a cover picture to continue."}
              </p>
            )}
            <PhotoConfirmation {...p.profileStep.confirmation} />
            <UploadTile
              shape="circle"
              label="Profile photo"
              maxMb={5}
              previewUrl={p.profileStep.avatarUrl}
              uploading={p.profileStep.uploading === "avatar"}
              disabled={!p.profileStep.confirmation.confirmed || p.profileStep.uploading !== null}
              note={p.profileStep.lockedHint ?? undefined}
              onFile={(f) => p.profileStep.uploadImage("avatar", f)}
            />
            <UploadTile
              shape="banner"
              label="Cover picture"
              maxMb={10}
              previewUrl={p.profileStep.coverUrl}
              uploading={p.profileStep.uploading === "cover"}
              disabled={!p.profileStep.confirmation.confirmed || p.profileStep.uploading !== null}
              note={p.profileStep.lockedHint ?? undefined}
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
                  <label className="mb-3 block">
                    <span className="sr-only">Search roles</span>
                    <input
                      type="search"
                      placeholder="Search roles"
                      value={p.profileStep.roleSearch}
                      onChange={(e) => p.profileStep.setRoleSearch(e.target.value)}
                      className="h-[44px] w-full rounded-lg border border-kink-edge bg-kink-field px-4 text-white outline-none focus:border-kink-gold-bright"
                    />
                  </label>
                  <div
                    className="max-h-[260px] overflow-y-auto overscroll-contain rounded-lg border border-kink-edge p-3"
                    role="region"
                    aria-label="Available roles"
                    tabIndex={0}
                  >
                    <RoleChips
                      options={p.profileStep.roleOptions}
                      selected={p.profileStep.roles}
                      onToggle={p.profileStep.toggleRole}
                    />
                    {p.profileStep.roleOptions.length === 0 && (
                      <p className="text-[13px] text-kink-help">No roles match your search.</p>
                    )}
                  </div>
                </div>
              )}
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
            {p.profileStep.canSkipPhotos && (
              <>
                <button
                  type="button"
                  onClick={p.profileStep.skipPhotos}
                  disabled={p.busy || p.profileStep.uploading !== null}
                  className="text-[14px] font-semibold text-kink-gold-bright underline disabled:opacity-50"
                >
                  Skip photos for now
                </button>
                <p className="text-center text-[12px] text-kink-help">
                  You can add your profile photo and cover picture later in Edit Profile.
                </p>
              </>
            )}
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
                  {p.welcome.emailVerified && (
                    <p className="mt-1.5 flex items-center gap-2 text-[13px] text-[#bfbfbf] lg:text-[17px]">
                      <CheckCircle2 size={16} className="shrink-0 text-[#59b240]" aria-hidden />
                      Email address verified
                    </p>
                  )}
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
