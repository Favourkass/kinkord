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
  invalidSignupFields,
  dobToIso,
  WIZARD_STEPS,
  type AccountDraft,
  type AboutDraft,
  type SignupField,
} from "@/domain/onboarding";
import { signupFixFieldsMessage } from "@/constants/onboarding";
import { Routes } from "@/constants/Routes";
import { PHOTO_CONFIRMATION_COPY } from "@/constants/photoConfirmation";
import { useVerification } from "./useVerification";

export type WizardStage = "country" | "account" | "about" | "email" | "profile" | "welcome";
const STAGE_STEP: Record<WizardStage, number> = {
  country: 1,
  account: 2,
  about: 2,
  email: 3,
  profile: 4,
  welcome: 5,
};

interface ProfileVM {
  avatarUrl: string | null;
  coverUrl: string | null;
  roles: string[];
}

/** Resume incomplete profile setup without collecting a phone during signup. */
export function useSignupWizardPresenter(initialStage: WizardStage = "country") {
  const router = useRouter();
  const [stage, setStage] = useState<WizardStage>(initialStage);
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
  // The field a failed Send OTP should bring into view. A fresh object per
  // attempt, so the screen scrolls again even when it's the same field.
  const [firstInvalid, setFirstInvalid] = useState<{ field: SignupField } | null>(null);

  // step 4
  const [roles, setRoles] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

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
    const invalid = invalidSignupFields(accErrors, abtErrors);
    if (invalid.length > 0) {
      setTopError(signupFixFieldsMessage(invalid));
      setFirstInvalid({ field: invalid[0] });
      return;
    }
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
      });
      setStage("email");
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [about, account, country]);

  // Sent automatically when step 3 opens: they typed the address moments ago.
  const emailCode = useVerification("email");

  // The address was typed moments ago, so the code goes out without asking.
  const emailSendCode = emailCode.sendCode;
  useEffect(() => {
    if (stage !== "email") return;
    emailSendCode();
  }, [stage, emailSendCode]);

  const nextVerificationStep = useCallback(() => {
    if (emailCode.verified) setStage("profile");
  }, [emailCode.verified]);

  // Resume saved photos and roles without overwriting them.
  const resumedAtPhotos = initialStage === "profile";
  useEffect(() => {
    if (!resumedAtPhotos) return;
    let live = true;
    api.get<ProfileVM>("/profile").then(
      (p) => {
        if (!live) return;
        setAvatarUrl((current) => current ?? p.avatarUrl);
        setCoverUrl((current) => current ?? p.coverUrl);
        setRoles((current) => (current.length > 0 ? current : p.roles));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [resumedAtPhotos]);

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
      firstInvalid,
      submitCombinedStep,
      backToCountry,
      verifyStep: {
        email: emailCode,
        nextStep: nextVerificationStep,
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
        resumed: resumedAtPhotos,
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
      firstInvalid,
      submitCombinedStep,
      backToCountry,
      nextVerificationStep,
      emailCode,
      roles,
      toggleRole,
      avatarUrl,
      coverUrl,
      uploading,
      uploadImage,
      photoConfirmed,
      profileError,
      completeProfile,
      resumedAtPhotos,
      finish,
    ],
  );
}
