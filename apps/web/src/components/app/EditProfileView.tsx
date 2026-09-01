import Image from "next/image";
import type { ChangeEvent } from "react";
import AvatarCircle from "./AvatarCircle";
import DesktopSidebar from "./DesktopSidebar";
import { BackChevronIcon, PencilBadge } from "./icons";

export interface EditProfileField {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  /** When present the field renders as a select instead of a text input. */
  options?: readonly string[];
}

export interface EditProfileViewProps {
  tagline: string;
  title: string;
  avatarUrl: string | null;
  displayName: string;
  /** [Display Name, Username] then the full-width rows in design order. */
  pairedFields: [EditProfileField, EditProfileField];
  fullFields: EditProfileField[];
  saveLabel: string;
  saving: boolean;
  uploading: boolean;
  notice: string | null;
  error: string | null;
  onFieldChange: (key: string, value: string) => void;
  onSave: () => void;
  onBack: () => void;
  onLogout: () => void;
  onAvatarFile: (file: File) => void;
  onCoverFile: (file: File) => void;
  profileHref: string;
  settingsHref: string;
}

function fileHandler(onFile: (file: File) => void) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };
}

function Input({
  field,
  onChange,
}: {
  field: EditProfileField;
  onChange: (key: string, value: string) => void;
}) {
  const styles =
    "h-[41px] w-full rounded-[10px] border border-app-input-border bg-app-input px-[27px] text-[15px] font-light text-app-value outline-none focus:border-kink-amber";
  return (
    <label className="block">
      <span className="block pb-[4px] pl-[12px] text-[14px] font-bold text-app-text">
        {field.label}
      </span>
      {field.options ? (
        <select
          value={field.value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={styles}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={field.value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={styles}
        />
      )}
    </label>
  );
}

function GoldCover({
  onCoverFile,
  uploading,
}: Pick<EditProfileViewProps, "onCoverFile" | "uploading">) {
  return (
    <>
      <Image src="/app/gold-metallic.png" alt="" fill sizes="100vw" className="object-cover" />
      <label className="absolute right-[19px] top-[18px] z-10 cursor-pointer">
        <PencilBadge className={uploading ? "opacity-50" : ""} />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={fileHandler(onCoverFile)}
        />
      </label>
    </>
  );
}

function AvatarWithEdit({
  avatarUrl,
  displayName,
  size,
  onAvatarFile,
  uploading,
}: Pick<EditProfileViewProps, "avatarUrl" | "displayName" | "onAvatarFile" | "uploading"> & {
  size: number;
}) {
  return (
    <div className="relative inline-block">
      <AvatarCircle
        src={avatarUrl}
        alt={displayName}
        size={size}
        ringClassName="bg-kink-gold-bright"
      />
      <label className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 cursor-pointer">
        <PencilBadge className={uploading ? "opacity-50" : ""} />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={fileHandler(onAvatarFile)}
        />
      </label>
    </div>
  );
}

/** Edit-profile screen — mobile sheet under a gold cover, desktop panel with sidebar. */
export default function EditProfileView(props: EditProfileViewProps) {
  const {
    tagline,
    title,
    avatarUrl,
    displayName,
    pairedFields,
    fullFields,
    saveLabel,
    saving,
    uploading,
    notice,
    error,
    onFieldChange,
    onSave,
    onBack,
    onLogout,
    profileHref,
    settingsHref,
  } = props;

  const status = (
    <>
      {error ? (
        <p className="pt-3 text-center text-[13px] font-semibold text-red-500">{error}</p>
      ) : null}
      {notice ? (
        <p className="pt-3 text-center text-[13px] font-semibold text-kink-amber">{notice}</p>
      ) : null}
    </>
  );

  const saveButton = (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className="h-[64px] w-full rounded-[10px] bg-kink-amber text-[20px] font-bold text-black disabled:opacity-60"
    >
      {saving ? "SAVING…" : saveLabel}
    </button>
  );

  return (
    <div className="min-h-dvh bg-app-page">
      {/* Mobile */}
      <div className="relative min-h-dvh bg-app-surface lg:hidden">
        <div className="relative h-[190px]">
          <GoldCover onCoverFile={props.onCoverFile} uploading={uploading} />
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="absolute left-[29px] top-[44px] z-10 text-black"
          >
            <BackChevronIcon />
          </button>
        </div>
        <div className="relative -mt-[69px] rounded-t-[40px] bg-app-surface px-[29px] pb-[40px]">
          <div className="absolute left-1/2 top-[-25px] -translate-x-1/2">
            <AvatarWithEdit
              avatarUrl={avatarUrl}
              displayName={displayName}
              size={117}
              onAvatarFile={props.onAvatarFile}
              uploading={uploading}
            />
          </div>
          <h1 className="pt-[37px] text-[24px] font-medium text-app-value">{title}</h1>
          <div className="grid grid-cols-2 gap-[41px] pt-[52px]">
            <Input field={pairedFields[0]} onChange={onFieldChange} />
            <Input field={pairedFields[1]} onChange={onFieldChange} />
          </div>
          <div className="flex flex-col gap-[24px] pt-[27px]">
            {fullFields.map((f) => (
              <Input key={f.key} field={f} onChange={onFieldChange} />
            ))}
          </div>
          {status}
          <div className="pt-[24px]">{saveButton}</div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden min-h-dvh lg:flex">
        <DesktopSidebar
          tagline={tagline}
          active="edit-profile"
          profileHref={profileHref}
          settingsHref={settingsHref}
          onLogout={onLogout}
        />
        <main className="relative min-h-dvh flex-1">
          <div className="relative h-[235px] overflow-hidden">
            <GoldCover onCoverFile={props.onCoverFile} uploading={uploading} />
            <div className="absolute inset-0 bg-black/25 dark:bg-black/40" />
          </div>
          <div className="absolute left-[69px] top-[91px] z-10">
            <AvatarWithEdit
              avatarUrl={avatarUrl}
              displayName={displayName}
              size={133}
              onAvatarFile={props.onAvatarFile}
              uploading={uploading}
            />
          </div>
          <div className="relative -mt-[1px] min-h-[calc(100dvh-234px)] rounded-[40px] bg-app-surface px-[71px] pb-[48px]">
            <div className="grid grid-cols-2 gap-x-[101px] gap-y-[22px] pt-[32px]">
              <Input field={pairedFields[0]} onChange={onFieldChange} />
              <Input field={pairedFields[1]} onChange={onFieldChange} />
              {fullFields.slice(0, 2).map((f) => (
                <Input key={f.key} field={f} onChange={onFieldChange} />
              ))}
            </div>
            <div className="flex flex-col gap-[22px] pt-[22px]">
              {fullFields.slice(2).map((f) => (
                <Input key={f.key} field={f} onChange={onFieldChange} />
              ))}
            </div>
            {status}
            <div className="mx-auto max-w-[382px] pt-[28px]">{saveButton}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
