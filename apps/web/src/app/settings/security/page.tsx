"use client";

import AppShell from "@/components/app/AppShell";
import SecurityView from "@/components/settings/SecurityView";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useSecurityPagePresenter } from "@/presenters/useSecurityPagePresenter";

/** Settings → Security & 2FA: change password and TOTP two-factor (moved here from /profile). */
export default function SecuritySettingsPage() {
  const shell = useHomePresenter();
  const vm = useSecurityPagePresenter();

  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
      <div className="mx-auto w-full max-w-[720px] px-[18px] pb-[32px] pt-[20px] lg:px-0">
        {vm.loading ? (
          <p className="text-[14px] text-app-subtle">Loading…</p>
        ) : vm.error ? (
          <p className="text-[14px] font-semibold text-red-500">{vm.error}</p>
        ) : (
          <SecurityView {...vm.view} />
        )}
      </div>
    </AppShell>
  );
}
