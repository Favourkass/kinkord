"use client";

import EditProfileView from "@/components/app/EditProfileView";
import { NG_LGAS } from "@/constants/nigeria";
import { NG_STATES } from "@/constants/onboarding";
import { Routes } from "@/constants/Routes";
import { useEditProfilePresenter } from "@/presenters/useEditProfilePresenter";

export default function EditProfilePage() {
  const vm = useEditProfilePresenter();

  if (vm.loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-app-page">
        <p className="text-[15px] font-semibold text-app-subtle">Loading your profile…</p>
      </div>
    );
  }

  return (
    <EditProfileView
      tagline="THE WORLD'S KINK COMMUNITY"
      title="Edit Profile"
      avatarUrl={vm.avatarUrl}
      displayName={vm.fields.displayName}
      pairedFields={[
        { key: "displayName", label: "Display Name", value: vm.fields.displayName },
        { key: "username", label: "Username", value: vm.fields.username },
      ]}
      fullFields={[
        { key: "gender", label: "Gender", value: vm.fields.gender },
        {
          key: "relationshipStatus",
          label: "Relationship Status",
          value: vm.fields.relationshipStatus,
        },
        { key: "role", label: "Role", value: vm.fields.role },
        {
          key: "lookingFor",
          label: "Looking for",
          value: vm.fields.lookingFor,
          placeholder: "Events, Relationships",
        },
        {
          key: "interests",
          label: "Interests",
          value: vm.fields.interests,
          placeholder: "Comma-separated interests",
        },
        {
          key: "state",
          label: "State",
          value: vm.fields.state,
          placeholder: "Select your state",
          options: NG_STATES,
        },
        {
          key: "lga",
          label: "LGA / Area",
          value: vm.fields.lga,
          placeholder: vm.fields.state ? "Select your area" : "Select your state first",
          options: NG_LGAS[vm.fields.state] ?? [],
        },
      ]}
      saveLabel="SAVE CHANGES"
      saving={vm.saving}
      uploading={vm.uploading}
      notice={vm.notice}
      error={vm.error}
      onFieldChange={vm.setField}
      onSave={vm.save}
      onBack={vm.back}
      onLogout={vm.logout}
      onAvatarFile={(f) => void vm.uploadImage("avatar", f)}
      onCoverFile={(f) => void vm.uploadImage("cover", f)}
      profileHref={Routes.profile}
      settingsHref={Routes.settings}
    />
  );
}
