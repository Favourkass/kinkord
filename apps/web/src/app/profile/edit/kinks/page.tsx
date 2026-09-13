"use client";

import EditScreen from "@/components/profile/edit/EditScreen";
import EditSectionView from "@/components/profile/edit/EditSectionView";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useEditSectionPresenter } from "@/presenters/useEditSectionPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** Edit Profile → kinks section (CEO brief 2026-09-12). */
export default function EditKinksPage() {
  const shell = useHomePresenter();
  const vm = useEditSectionPresenter("kinks");

  return (
    <EditScreen
      shell={appShellProps(shell, getAppShellNav())}
      title={vm.title}
      backLabel={vm.backLabel}
      onBack={vm.back}
      loading={vm.loading}
      loadingLabel={vm.loadingLabel}
      error={vm.error}
    >
      <EditSectionView
        heading={vm.heading}
        subtitle={vm.subtitle}
        variant={vm.variant}
        rows={vm.rows}
        notice={vm.notice}
        error={null}
        editor={vm.editor}
      />
    </EditScreen>
  );
}
