import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import EditRowsCard, { type EditRowItem } from "./EditRowsCard";

export interface EditHubProps {
  subtitle: string;
  avatarUrl: string | null;
  name: string;
  /** "· @nene" */
  handle: string | null;
  tierLabel: string;
  changePhotoLabel: string;
  rows: EditRowItem[];
  error: string | null;
  onChangePhoto: () => void;
}

/** Edit Profile hub (Figma 1542:30 dark / 1542:164 light): identity + the five sections. */
export default function EditHub(p: EditHubProps) {
  return (
    <div className="flex w-full flex-col items-center gap-[24px]">
      <p className="max-w-[299px] text-center text-[12px] italic text-pf-muted">{p.subtitle}</p>
      <div className="flex w-full items-end gap-[3px]">
        <div className="relative size-[110px] shrink-0">
          <div className="absolute left-[5px] top-[5px]">
            <AvatarCircle
              src={p.avatarUrl}
              alt={p.name}
              size={98}
              ringClassName="bg-kink-gold-bright"
            />
          </div>
          <button
            type="button"
            onClick={p.onChangePhoto}
            className="absolute left-[75px] top-[75px] grid size-[28px] cursor-pointer place-items-center rounded-[14px] bg-kink-gold-bright text-black"
          >
            <MaskIcon
              src="/app/profile/icon-camera-fill.svg"
              width={16}
              label={p.changePhotoLabel}
            />
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-[6px] pb-[8px]">
          <p className="truncate text-[16px] font-bold text-pf-text">{p.name}</p>
          {p.handle ? <p className="truncate text-[14px] text-pf-muted">{p.handle}</p> : null}
          <span className="inline-flex w-fit items-center gap-[2px] rounded-[24px] bg-kink-gold-bright/10 px-[4px] py-[2px] text-[10px] text-pf-text">
            <MaskIcon
              src="/app/profile/icon-crown.svg"
              width={20}
              className="text-kink-gold-bright"
            />
            {p.tierLabel}
          </span>
        </div>
      </div>
      <EditRowsCard rows={p.rows} />
      {p.error ? <p className="text-[13px] font-semibold text-red-500">{p.error}</p> : null}
    </div>
  );
}
