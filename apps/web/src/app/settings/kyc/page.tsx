"use client";

import Script from "next/script";
import AppShell from "@/components/app/AppShell";
import BronzeVerificationView from "@/components/settings/BronzeVerificationView";
import KycProgressView from "@/components/settings/KycProgressView";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useBronzeVerificationPresenter } from "@/presenters/useBronzeVerificationPresenter";
import { useKycPresenter } from "@/presenters/useKycPresenter";

/** Phase one uses the existing audited identity provider flow behind the KYC screen. */
export default function KycPage() {
  const shell = useHomePresenter();
  const presenter = useBronzeVerificationPresenter();
  const kyc = useKycPresenter();
  return <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
    <Script src="https://cdn.smileidentity.com/inline/v1/js/script.min.js" strategy="afterInteractive" onReady={presenter.onScriptReady} onError={presenter.onScriptError} />
    <div className="mx-auto w-full max-w-[720px] px-[18px] pb-8 pt-5 lg:px-0">
      {kyc.loading ? <p className="text-app-subtle">Loading KYC progress…</p> : null}
      {kyc.view ? <KycProgressView {...kyc.view} onLocationConsentChange={kyc.setLocationConsentAccepted} onCaptureLocation={kyc.captureLocation} onFinancialConsentChange={kyc.setFinancialConsentAccepted} onStartFinancial={kyc.startFinancial} onRefresh={kyc.refresh} /> : null}
      {kyc.error ? <p role="status" className="mt-4 text-sm text-app-subtle">{kyc.error}</p> : null}
      {presenter.loading ? <p className="text-app-subtle">Loading…</p> : null}
      {presenter.view ? <BronzeVerificationView {...presenter.view} /> : null}
      {presenter.error ? <p role="alert" className="mt-4 text-sm font-semibold text-red-500">{presenter.error}</p> : null}
    </div>
  </AppShell>;
}
