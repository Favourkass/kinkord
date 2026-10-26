"use client";
import AppShell from "@/components/app/AppShell";
import NotificationSettings from "@/components/settings/NotificationSettings";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useNotificationSettingsPresenter } from "@/presenters/useNotificationSettingsPresenter";

export default function NotificationSettingsPage() {
  const shell = useHomePresenter();
  const vm = useNotificationSettingsPresenter();
  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="settings">
      <NotificationSettings {...vm} />
    </AppShell>
  );
}
