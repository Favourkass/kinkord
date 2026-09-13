import type { ChangeEvent } from "react";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";

export interface PhotoCardVM {
  title: string;
  subtitle: string;
  hint: string;
  actionLabel: string;
  changeLabel: string;
  url: string | null;
  uploading: boolean;
  uploadingLabel: string;
}

export interface EditPhotosProps {
  heading: string;
  subtitle: string;
  avatar: PhotoCardVM;
  cover: PhotoCardVM;
  notice: string | null;
  error: string | null;
  onAvatarFile: (file: File) => void;
  onCoverFile: (file: File) => void;
}

const pickWith = (onFile: (file: File) => void) => (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) onFile(file);
  e.target.value = "";
};

function Card({
  vm,
  icon,
  onFile,
  children,
}: {
  vm: PhotoCardVM;
  icon: string;
  onFile: (file: File) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-[20px] rounded-[24px] border border-pf-border bg-pf-card p-[16px]">
      <div className="flex items-center gap-[12px]">
        <span className="grid size-[36px] shrink-0 place-items-center rounded-[10px] bg-pf-surface-2 text-kink-gold-bright">
          <MaskIcon src={icon} width={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-pf-text">{vm.title}</p>
          <p className="text-[11px] text-pf-muted">{vm.subtitle}</p>
        </div>
        <label
          className={`flex cursor-pointer items-center gap-[6px] rounded-[16px] border border-kink-gold-bright px-[14px] py-[6px] text-[12px] font-semibold text-kink-gold-bright ${
            vm.uploading ? "opacity-50" : ""
          }`}
        >
          <MaskIcon src="/app/profile/icon-pencil-12.svg" width={12} />
          {vm.uploading ? vm.uploadingLabel : vm.actionLabel}
          <MaskIcon src="/app/profile/icon-chevron-right-10.svg" width={10} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={vm.uploading}
            aria-label={vm.changeLabel}
            onChange={pickWith(onFile)}
          />
        </label>
      </div>
      {children}
      <p className="text-center text-[11px] text-pf-muted">{vm.hint}</p>
    </section>
  );
}

/** Photos & Media (Figma 1524:1786): profile photo and cover, each with a camera badge. */
export default function EditPhotos(p: EditPhotosProps) {
  const badge = (size: number, label: string, uploading: boolean, onFile: (f: File) => void) => (
    <label
      className={`absolute bottom-0 right-0 grid cursor-pointer place-items-center rounded-full bg-kink-gold-bright text-black ${
        uploading ? "opacity-50" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <MaskIcon
        src="/app/profile/icon-camera-fill.svg"
        width={Math.round(size / 2)}
        label={label}
      />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={pickWith(onFile)}
      />
    </label>
  );

  return (
    <div className="flex w-full flex-col items-center gap-[20px]">
      <div className="flex flex-col gap-[8px] text-center text-[12px] text-pf-muted">
        <p className="font-bold">{p.heading}</p>
        <p className="italic">{p.subtitle}</p>
      </div>

      <Card vm={p.avatar} icon="/app/profile/icon-gallery.svg" onFile={p.onAvatarFile}>
        <div className="relative mx-auto size-[140px]">
          <div className="absolute inset-0 rounded-full border-[3px] border-kink-gold-bright" />
          <div className="absolute inset-[3px] overflow-hidden rounded-full">
            <AvatarCircle
              src={p.avatar.url}
              alt={p.avatar.title}
              size={132}
              ringClassName="bg-transparent"
            />
          </div>
          {badge(36, p.avatar.changeLabel, p.avatar.uploading, p.onAvatarFile)}
        </div>
      </Card>

      <Card vm={p.cover} icon="/app/profile/icon-cover-image.svg" onFile={p.onCoverFile}>
        <div className="relative h-[160px] w-full overflow-hidden rounded-[16px] border border-pf-border bg-pf-surface-2">
          {p.cover.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
            <img src={p.cover.url} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-pf-muted">
              <MaskIcon src="/app/profile/icon-cover-image.svg" width={40} />
            </div>
          )}
          <div className="absolute bottom-[10px] right-[10px] size-[32px]">
            {badge(32, p.cover.changeLabel, p.cover.uploading, p.onCoverFile)}
          </div>
        </div>
      </Card>

      {p.notice ? (
        <p className="text-[13px] font-semibold text-kink-gold-bright">{p.notice}</p>
      ) : null}
      {p.error ? <p className="text-[13px] font-semibold text-red-500">{p.error}</p> : null}
    </div>
  );
}
