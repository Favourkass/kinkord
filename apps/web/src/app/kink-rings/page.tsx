"use client";
import AppShell from "@/components/app/AppShell";
import KinkRingsScreen from "@/components/kink-rings/KinkRingsScreen";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useHomePresenter } from "@/presenters/useHomePresenter";
import { useKinkRingsPresenter } from "@/presenters/useKinkRingsPresenter";

/** Kink Rings: a month of Silver to give away. */
export default function KinkRingsPage() {
  const shell = useHomePresenter();
  const vm = useKinkRingsPresenter();
  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="none">
      <KinkRingsScreen {...vm} />
    </AppShell>
  );
}
