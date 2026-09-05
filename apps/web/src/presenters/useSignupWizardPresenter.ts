"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/services/authClient";
import { api, uploadToPresignedUrl } from "@/services/apiClient";
import { compressImage } from "@/util/image";
import {
  validateAccount,
  validateAbout,
  toE164,
  dobToIso,
  WIZARD_STEPS,
  type AccountDraft,
  type AboutDraft,
} from "@/domain/onboarding";
import { Routes } from "@/constants/Routes";

export type WizardStage = "country" | "account" | "about" | "verify" | "profile" | "welcome";
const STAGE_STEP: Record<WizardStage, number> = {
  country: 1,
  account: 2,
  about: 2,
  verify: 3,
  profile: 4,
  welcome: 4,
};

interface ProfileVM {
  phoneVerified: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
}

export function useSignupWizardPresenter() {
  const router = useRouter();
  const [stage, setStage] = useState<WizardStage>("country");
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // step 1
  const [country, setCountry] = useState<string | null>(null);
  const [ageAttested, setAgeAttested] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [stepOneTouched, setStepOneTouched] = useState(false);

  // step 2
  const [account, setAccount] = useState<AccountDraft>({
    username: "",
    displayName: "",
    email: "",
    phoneLocal: "",
    phoneCountryCode: "+234",
    password: "",
    confirmPassword: "",
  });
  const [accountErrors, setAccountErrors] = useState<ReturnType<typeof validateAccount>>({});
  const [about, setAbout] = useState<AboutDraft>({
    state: "",
    city: "",
    dobDay: null,
    dobMonth: null,
    dobYear: null,
    gender: null,
  });
  const [aboutErrors, setAboutErrors] = useState<ReturnType<typeof validateAbout>>({});

  // step 4
  const [roles, setRoles] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [noMinors, setNoMinors] = useState(false);
  const [consentThirdParty, setConsentThirdParty] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const step = STAGE_STEP[stage];

  const submitCountry = useCallback(() => {
    setStepOneTouched(true);
    if (!country || !ageAttested || !termsAccepted) return;
    setStage("account");
  }, [country, ageAttested, termsAccepted]);

  const submitAccount = useCallback(() => {
    const errors = validateAccount(account);
    setAccountErrors(errors);
    if (Object.keys(errors).length === 0) setStage("about");
  }, [account]);

  const submitAbout = useCallback(async () => {
    const errors = validateAbout(about);
    setAboutErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setTopError(null);
    try {
      const { error } = await authClient.signUp.email({
        email: account.email.trim(),
        password: account.password,
        name: account.displayName.trim(),
        username: account.username.replace(/^@/, "").toLowerCase(),
        ageAttested: true,
      } as Parameters<typeof authClient.signUp.email>[0]);
      if (error) throw new Error(error.message ?? "Sign up failed");
      await api.patch("/profile", {
        country,
        state: about.state,
        city: about.city.trim() || null,
        dateOfBirth: dobToIso(about),
        gender: about.gender,
        phone: account.phoneLocal.trim()
          ? toE164(account.phoneCountryCode, account.phoneLocal)
          : null,
      });
      setStage("verify");
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [about, account, country]);

  const backToCountry = useCallback(() => setStage("country"), []);

  const submitCombinedStep = useCallback(async () => {
    const accErrors = validateAccount(account);
    const abtErrors = validateAbout(about);
    setAccountErrors(accErrors);
    setAboutErrors(abtErrors);
    if (Object.keys(accErrors).length > 0 || Object.keys(abtErrors).length > 0) return;
    setBusy(true);
    setTopError(null);
    try {
      const { error } = await authClient.signUp.email({
        email: account.email.trim(),
        password: account.password,
        name: account.displayName.trim(),
        username: account.username.replace(/^@/, "").toLowerCase(),
        ageAttested: true,
      } as Parameters<typeof authClient.signUp.email>[0]);
      if (error) throw new Error(error.message ?? "Sign up failed");
      await api.patch("/profile", {
        country,
        state: about.state,
        city: about.city.trim() || null,
        dateOfBirth: dobToIso(about),
        gender: about.gender,
        phone: account.phoneLocal.trim()
          ? toE164(account.phoneCountryCode, account.phoneLocal)
          : null,
      });
      setStage("verify");
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [about, account, country]);

  const skipVerification = useCallback(() => setStage("profile"), []);

  const uploadImage = useCallback(async (kind: "avatar" | "cover", rawFile: File) => {
    setUploading(kind);
    setProfileError(null);
    try {
      // Shrink phone photos before upload so they survive slow connections.
      const file = await compressImage(rawFile);
      const spec = await api.post<{ key: string; uploadUrl: string; maxSizeMb: number }>(
        "/profile/upload-url",
        { kind, contentType: file.type },
      );
      if (file.size > spec.maxSizeMb * 1024 * 1024) {
        throw new Error(`Image is too large — max ${spec.maxSizeMb}MB.`);
      }
      await uploadToPresignedUrl(spec.uploadUrl, file);
      const vm = await api.patch<ProfileVM>(
        "/profile",
        kind === "avatar" ? { avatarKey: spec.key } : { coverKey: spec.key },
      );
      if (kind === "avatar") setAvatarUrl(vm.avatarUrl);
      else setCoverUrl(vm.coverUrl);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(null);
    }
  }, []);

  const toggleRole = useCallback((role: string) => {
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]));
  }, []);

  const completeProfile = useCallback(async () => {
    if (!avatarUrl || !coverUrl) {
      setProfileError("Profile photo and cover picture are required.");
      return;
    }
    if (!noMinors || !consentThirdParty) {
      setProfileError("Please confirm both statements about your photographs.");
      return;
    }
    setBusy(true);
    setProfileError(null);
    try {
      await api.patch("/profile", { roles });
      setStage("welcome");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }, [avatarUrl, coverUrl, noMinors, consentThirdParty, roles]);

  const finish = useCallback(() => router.push(Routes.appHome), [router]);

  return useMemo(
    () => ({
      stage,
      step,
      totalSteps: WIZARD_STEPS,
      busy,
      topError,
      stepOne: {
        country,
        setCountry,
        ageAttested,
        setAgeAttested,
        termsAccepted,
        setTermsAccepted,
        touched: stepOneTouched,
        submit: submitCountry,
      },
      accountStep: {
        draft: account,
        set: setAccount,
        errors: accountErrors,
        submit: submitAccount,
      },
      aboutStep: { draft: about, set: setAbout, errors: aboutErrors, submit: submitAbout },
      submitCombinedStep,
      backToCountry,
      verifyStep: { skip: skipVerification },
      profileStep: {
        roles,
        toggleRole,
        avatarUrl,
        coverUrl,
        uploading,
        uploadImage,
        noMinors,
        setNoMinors,
        consentThirdParty,
        setConsentThirdParty,
        error: profileError,
        submit: completeProfile,
      },
      finish,
    }),
    [
      stage,
      step,
      busy,
      topError,
      country,
      ageAttested,
      termsAccepted,
      stepOneTouched,
      submitCountry,
      account,
      accountErrors,
      submitAccount,
      about,
      aboutErrors,
      submitAbout,
      submitCombinedStep,
      backToCountry,
      skipVerification,
      roles,
      toggleRole,
      avatarUrl,
      coverUrl,
      uploading,
      uploadImage,
      noMinors,
      consentThirdParty,
      profileError,
      completeProfile,
      finish,
    ],
  );
}
