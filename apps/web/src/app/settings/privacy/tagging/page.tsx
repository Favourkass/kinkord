"use client";
import AppShell from "@/components/app/AppShell";
import PrivacySettings from "@/components/settings/PrivacySettings";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { usePrivacyPresenter } from "@/presenters/usePrivacyPresenter";
export default function PrivacyCategoryPage() {
  const shell = useHomePresenter();
  const vm = usePrivacyPresenter("tagging");
  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
      <PrivacySettings {...vm} />
    </AppShell>
  );
}
