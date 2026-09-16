"use client";

import Script from "next/script";
import AppShell from "@/components/app/AppShell";
import BronzeVerificationView from "@/components/settings/BronzeVerificationView";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useBronzeVerificationPresenter } from "@/presenters/useBronzeVerificationPresenter";

export default function BronzeVerificationPage() {
  const shell = useHomePresenter();
  const presenter = useBronzeVerificationPresenter();
  return <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
    <Script src="https://cdn.smileidentity.com/inline/v1/js/script.min.js" strategy="afterInteractive" onReady={presenter.onScriptReady} onError={presenter.onScriptError} />
    <div className="mx-auto w-full max-w-[720px] px-[18px] pb-8 pt-5 lg:px-0">
      {presenter.loading ? <p className="text-app-subtle">Loading…</p> : null}
      {presenter.view ? <BronzeVerificationView {...presenter.view} /> : null}
      {presenter.error ? <p role="alert" className="mt-4 text-sm font-semibold text-red-500">{presenter.error}</p> : null}
    </div>
  </AppShell>;
}
