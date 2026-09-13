"use client";

import EditHub from "@/components/profile/edit/EditHub";
import EditScreen from "@/components/profile/edit/EditScreen";
import { appShellProps, getAppShellNav } from "@/presenters/getAppShellNav";
import { useEditProfileHubPresenter } from "@/presenters/useEditProfileHubPresenter";
import { useHomePresenter } from "@/presenters/useHomePresenter";

/** Edit Profile hub (Figma 1542:30 / 1542:164). */
export default function EditProfilePage() {
  const shell = useHomePresenter();
  const vm = useEditProfileHubPresenter();

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
      <EditHub
        subtitle={vm.subtitle}
        avatarUrl={vm.avatarUrl}
        name={vm.name}
        handle={vm.handle}
        tierLabel={vm.tierLabel}
        changePhotoLabel={vm.changePhotoLabel}
        uploading={vm.uploading}
        rows={vm.rows}
        notice={vm.notice}
        error={vm.error}
        onAvatarFile={vm.onAvatarFile}
      />
    </EditScreen>
  );
}
