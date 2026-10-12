"use client";

import AppShell from "@/components/app/AppShell";
import BronzeVerificationView from "@/components/settings/BronzeVerificationView";
import { VERIFICATION_COPY } from "@/constants/verification";
import { getAppShellNav } from "@/presenters/getAppShellNav";
import { useBronzeVerificationPresenter } from "@/presenters/useBronzeVerificationPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** Settings → Verification: identity verification through Didit. */
export default function VerificationPage() {
  const shell = useHomePresenter();
  const p = useBronzeVerificationPresenter();
  const nav = getAppShellNav();
  return (
    <AppShell
      brand="KINKORD"
      tagline="THE WORLD'S KINK COMMUNITY"
      greeting={shell.greeting}
      name={shell.name}
      handle={shell.handle}
      avatarUrl={shell.avatarUrl}
      membersCount={shell.membersCount}
      notificationsUnread={shell.notificationsUnread}
      notificationsCount={shell.notificationsCount}
      messagesCount={shell.messagesCount}
      activeNav="settings"
      drawerOpen={shell.drawerOpen}
      onMenu={shell.openDrawer}
      onCloseDrawer={shell.closeDrawer}
      onLogout={shell.logout}
      links={nav.links}
      labels={nav.labels}
    >
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
