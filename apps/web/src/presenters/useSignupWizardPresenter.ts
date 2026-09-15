"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadToPresignedUrl } from "@/services/apiClient";
import { IMAGE_VARIANTS, buildUploadSet, type ImageVariant } from "@/util/image";

/** Presigned PUT slots returned by POST /profile/upload-url — one per stored size. */
interface UploadSlots {
  key: string;
  uploadUrl: string;
  variantUploadUrls: Record<ImageVariant, string>;
  maxSizeMb: number;
}
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
import { PHOTO_CONFIRMATION_COPY } from "@/constants/photoConfirmation";
import {
  attemptsMessage,
  phoneErrorMessage,
  phoneVerificationApi,
  type PhoneCodeSentPM,
} from "@/services/phoneVerification.service";

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

  // step 2 (account + about, one combined screen)
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
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<PhoneCodeSentPM | null>(null);
  const [codeDigits, setCodeDigits] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const step = STAGE_STEP[stage];

  const submitCountry = useCallback(() => {
    setStepOneTouched(true);
    if (!country || !ageAttested || !termsAccepted) return;
    setStage("account");
  }, [country, ageAttested, termsAccepted]);

  const backToCountry = useCallback(() => setStage("country"), []);

  /**
   * The account + about fields live on one screen, so they're created together
   * in a single atomic call (POST /auth-ext/sign-up): the server creates the
   * account and writes the about-fields, rolling the account back if the second
   * half fails — so a retry never hits "email already exists".
   */
  const submitCombinedStep = useCallback(async () => {
    const accErrors = validateAccount(account);
    const abtErrors = validateAbout(about);
    setAccountErrors(accErrors);
    setAboutErrors(abtErrors);
    if (Object.keys(accErrors).length > 0 || Object.keys(abtErrors).length > 0) return;
    setBusy(true);
    setTopError(null);
    try {
      await api.post("/auth-ext/sign-up", {
        email: account.email.trim(),
        password: account.password,
        displayName: account.displayName.trim(),
        username: account.username.replace(/^@/, "").toLowerCase(),
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

  /** Countdown for the resend link; the API enforces the same cooldown itself. */
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    setSendingCode(true);
    setVerifyError(null);
    try {
      const sent = await phoneVerificationApi.sendCode();
      setChallenge(sent);
      setCodeDigits("");
      setResendIn(Math.ceil(sent.resendAfterMs / 1000));
    } catch (e) {
      setVerifyError(phoneErrorMessage(e, "Could not send the code. Try again."));
    } finally {
      setSendingCode(false);
    }
  }, []);

  const verifyCode = useCallback(async () => {
    if (!challenge) return;
    if (!/^\d{6}$/.test(codeDigits)) {
      setVerifyError("Enter the 6-digit code.");
      return;
    }
    setVerifyingCode(true);
    setVerifyError(null);
    try {
      const result = await phoneVerificationApi.verify(challenge.otpId, codeDigits);
      if (result.verified) {
        setPhoneVerified(true);
        setStage("profile");
        return;
      }
      setCodeDigits("");
      setVerifyError(
        attemptsMessage(result.attemptsLeft) ??
          "That code is wrong or has expired. Send a new one.",
      );
    } catch (e) {
      setVerifyError(phoneErrorMessage(e, "Could not check the code. Try again."));
    } finally {
      setVerifyingCode(false);
    }
  }, [challenge, codeDigits]);

  const skipVerification = useCallback(() => setStage("profile"), []);

  const uploadImage = useCallback(
    async (kind: "avatar" | "cover", rawFile: File) => {
      if (!photoConfirmed) {
        setProfileError(PHOTO_CONFIRMATION_COPY.requiredError);
        return;
      }
      setUploading(kind);
      setProfileError(null);
      try {
        // Shrink phone photos before upload so they survive slow connections, and
        // derive the smaller stored sizes from the compressed original.
        const { original, variants } = await buildUploadSet(rawFile, kind);
        const spec = await api.post<UploadSlots>("/profile/upload-url", {
          kind,
          contentType: original.type,
          contentLength: original.size,
        });
        if (original.size > spec.maxSizeMb * 1024 * 1024) {
          throw new Error(`Image is too large — max ${spec.maxSizeMb}MB.`);
        }
        // Variants first, original last: the profile is only pointed at the photo
        // after every size has landed.
        await Promise.all(
          IMAGE_VARIANTS.map((v) => uploadToPresignedUrl(spec.variantUploadUrls[v], variants[v])),
        );
        await uploadToPresignedUrl(spec.uploadUrl, original);
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
    },
    [photoConfirmed],
  );

  const toggleRole = useCallback((role: string) => {
    setRoles((r) => (r.includes(role) ? r.filter((x) => x !== role) : [...r, role]));
  }, []);

  const completeProfile = useCallback(async () => {
    if (!avatarUrl || !coverUrl) {
      setProfileError("Profile photo and cover picture are required.");
      return;
    }
    if (!photoConfirmed) {
      setProfileError(PHOTO_CONFIRMATION_COPY.requiredError);
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
  }, [avatarUrl, coverUrl, photoConfirmed, roles]);

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
      accountStep: { draft: account, set: setAccount, errors: accountErrors },
      aboutStep: { draft: about, set: setAbout, errors: aboutErrors },
      submitCombinedStep,
      backToCountry,
      verifyStep: {
        skip: skipVerification,
        phone: challenge?.sentTo ?? null,
        sent: challenge !== null,
        code: codeDigits,
        setCode: setCodeDigits,
        sendCode: () => {
          void sendCode();
        },
        verify: () => {
          void verifyCode();
        },
        sending: sendingCode,
        verifying: verifyingCode,
        error: verifyError,
        resendIn,
        canResend: resendIn === 0 && !sendingCode,
        verified: phoneVerified,
      },
      profileStep: {
        roles,
        toggleRole,
        avatarUrl,
        coverUrl,
        uploading,
        uploadImage,
        lockedHint: photoConfirmed ? null : PHOTO_CONFIRMATION_COPY.lockedHint,
        confirmation: {
          ...PHOTO_CONFIRMATION_COPY,
          confirmed: photoConfirmed,
          disabled: uploading !== null,
          onConfirmedChange: (confirmed: boolean) => {
            setPhotoConfirmed(confirmed);
            if (confirmed) setProfileError(null);
          },
        },
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
      about,
      aboutErrors,
      submitCombinedStep,
      backToCountry,
      skipVerification,
      challenge,
      codeDigits,
      sendingCode,
      verifyingCode,
      verifyError,
      resendIn,
      phoneVerified,
      sendCode,
      verifyCode,
      roles,
      toggleRole,
      avatarUrl,
      coverUrl,
      uploading,
      uploadImage,
      photoConfirmed,
      profileError,
      completeProfile,
      finish,
    ],
  );
}
