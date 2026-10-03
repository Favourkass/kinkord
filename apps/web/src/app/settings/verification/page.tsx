"use client";

import AppShell from "@/components/app/AppShell";
import BronzeVerificationView from "@/components/settings/BronzeVerificationView";
import { VERIFICATION_COPY } from "@/constants/verification";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useBronzeVerificationPresenter } from "@/presenters/useBronzeVerificationPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** Settings → Verification: identity verification through Didit. */
export default function VerificationPage() {
  const shell = useHomePresenter();
  const p = useBronzeVerificationPresenter();
  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="verification">
      <div className="mx-auto w-full max-w-[560px] px-[18px] pb-[32px] pt-[20px] lg:px-0">
        {p.loading ? <p className="text-app-subtle">{VERIFICATION_COPY.loading}</p> : null}
        {p.error ? (
          <p role="alert" className="text-[14px] text-app-danger">
            {p.error}
          </p>
        ) : null}
        {p.view ? <BronzeVerificationView {...p.view} /> : null}
      </div>
    </AppShell>
  );
}
