"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bronzeStatusText, type BronzeVerificationPM } from "@/domain/bronzeVerification";
import { Routes } from "@/constants/Routes";
import { ApiError } from "@/services/apiClient";
import { bronzeVerificationApi } from "@/services/bronzeVerification.service";

interface SmileWidgetConfig {
  token: string;
  product: "biometric_kyc";
  callback_url: string;
  environment: "sandbox" | "live";
  partner_details: { partner_id: string; name: string; logo_url: string; policy_url: string; theme_color: string };
  onSuccess: () => void;
  onClose: () => void;
  onError: (error: { message?: string }) => void;
}

declare global {
  interface Window { SmileIdentity?: (config: SmileWidgetConfig) => void }
}

const missingLabels: Record<string, string> = {
  profilePhoto: "a recent, genuine photo of yourself",
  dateOfBirth: "your date of birth",
  gender: "your gender",
  country: "your country",
};

export function useBronzeVerificationPresenter() {
  const router = useRouter();
  const [state, setState] = useState<BronzeVerificationPM | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await bronzeVerificationApi.status());
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace(Routes.login);
      else setError("Could not load verification status. Please try again.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (state?.status !== "pending") return;
    const timer = setInterval(() => { void refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [refresh, state?.status]);

  const start = async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!state.consented) await bronzeVerificationApi.consent(state.policyVersion);
      const session = await bronzeVerificationApi.start();
      if (session.provider === "didit") {
        window.location.assign(session.url);
        return;
      }
      if (!window.SmileIdentity) throw new Error("The verification camera could not load. Refresh and try again.");
      setState(await bronzeVerificationApi.status());
      window.SmileIdentity({
        token: session.token,
        product: session.product,
        callback_url: session.callbackUrl,
        environment: session.environment,
        partner_details: {
          partner_id: session.partnerId,
          name: "Kinkord",
          logo_url: `${window.location.origin}/favicon.ico`,
          policy_url: session.policyUrl,
          theme_color: "#ffbd29",
        },
        onSuccess: () => { void refresh(); },
        onClose: () => { void refresh(); },
        onError: (failure) => setError(failure?.message ?? "Verification was interrupted."),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start verification.";
      await refresh();
      setError(message);
    } finally { setBusy(false); }
  };

  return {
    loading, error, onScriptReady: () => setWidgetReady(true),
    onScriptError: () => {
      if (state?.provider === "smile") setError("The verification camera could not load.");
    },
    view: state ? {
      status: bronzeStatusText(state.status),
      attemptsRemaining: state.attemptsRemaining,
      missing: state.missing.map((key) => missingLabels[key] ?? key),
      checked, onChecked: setChecked,
      busy,
      canStart: (state.provider === "didit" || widgetReady) && state.providerAvailable && checked && !busy &&
        state.missing.length === 0 && (state.status === "not_started" || state.status === "failed"),
      providerAvailable: state.providerAvailable,
      policyUrl: state.policyUrl,
      onStart: () => { void start(); },
      onRefresh: () => { void refresh(); },
      editProfileHref: Routes.profileEdit,
    } : null,
  };
}
