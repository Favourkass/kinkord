"use client";

import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import ComingSoonPanel from "@/components/app/ComingSoonPanel";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { getComingSoonFeatureVM } from "@/presenters/getComingSoonFeatureVM";
import { useHomePresenter } from "@/presenters/useHomePresenter";

export default function FeatureComingSoonPage() {
  const { feature } = useParams<{ feature: string }>();
  const shell = useHomePresenter();
  const copy = getComingSoonFeatureVM(feature);

  return (
    <AppShell {...appShellProps(shell, getAppShellNav())} activeNav="none">
      <ComingSoonPanel {...copy} />
    </AppShell>
  );
}
