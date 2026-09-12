"use client";

import EditPhotos from "@/components/profile/edit/EditPhotos";
import EditScreen from "@/components/profile/edit/EditScreen";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useEditPhotosPresenter } from "@/presenters/useEditPhotosPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** Edit Profile → Photos & Media (Figma 1524:1786). */
export default function EditPhotosPage() {
  const shell = useHomePresenter();
  const vm = useEditPhotosPresenter();

  return (
    <EditScreen
      shell={appShellProps(shell, getAppShellNav())}
      title={vm.title}
      backLabel={vm.backLabel}
      onBack={vm.back}
      loading={vm.loading}
      loadingLabel={vm.loadingLabel}
      error={null}
    >
      <EditPhotos
        heading={vm.heading}
        subtitle={vm.subtitle}
        avatar={vm.avatar}
        cover={vm.cover}
        notice={vm.notice}
        error={vm.error}
        onAvatarFile={vm.onAvatarFile}
        onCoverFile={vm.onCoverFile}
      />
    </EditScreen>
  );
}
