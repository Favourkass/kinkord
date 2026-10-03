"use client";

import AppShell from "@/components/app/AppShell";
import ComingSoonPanel from "@/components/app/ComingSoonPanel";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import type { ComingSoonFeatureVM } from "@/presenters/getComingSoonFeatureVM";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** An unfinished menu destination, inside the signed-in app. */
export default function ComingSoonFeatureScreen({ copy }: { copy: ComingSoonFeatureVM }) {
  const shell = useHomePresenter();
  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="none">
      <ComingSoonPanel {...copy} />
    </AppShell>
  );
}
