"use client";
import AppShell from "@/components/app/AppShell";
import PrivacyMenu from "@/components/settings/PrivacyMenu";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { getPrivacyMenuVM } from "@/presenters/getPrivacyMenuVM";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function PrivacyPage() {
  const shell = useHomePresenter();
  const vm = getPrivacyMenuVM();
  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
      <PrivacyMenu {...vm} />
    </AppShell>
  );
}
