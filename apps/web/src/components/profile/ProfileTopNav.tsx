import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import MaskIcon from "@/components/app/MaskIcon";
import type { AppNavLabels, AppNavLinks } from "@/components/app/nav";

export interface ProfileTopNavProps {
  brand: string;
  searchHref: string;
  searchPlaceholder: string;
  accountLabel: string;
  viewerAvatarUrl: string | null;
  links: Pick<AppNavLinks, "home" | "chat" | "notifications" | "settings" | "profile">;
  labels: Pick<AppNavLabels, "home" | "chat" | "notifications" | "settings" | "profile">;
}

/** Figma desktop profile TopNav (987:5468): wordmark, 480px search pill, icon circles, "My Account". */
export default function ProfileTopNav(p: ProfileTopNavProps) {
  const circle =
    "grid size-[36px] place-items-center rounded-[20px] border border-pf-border bg-pf-surface text-pf-icon";
  return (
    <header className="flex items-center justify-between border-b border-pf-border bg-pf-nav px-[32px] py-[14px]">
      <p className="text-[24px] font-bold leading-none tracking-[0.96px] text-kink-gold-bright">
        {p.brand}
      </p>
      <Link
        href={p.searchHref}
        className="flex w-[480px] items-center gap-[10px] rounded-[99px] border border-pf-border bg-pf-surface px-[16px] py-[8px] text-pf-muted"
      >
        <MaskIcon name="nav-search" width={16} className="text-pf-muted" />
        <span className="text-[14px] leading-[17px]">{p.searchPlaceholder}</span>
      </Link>
      <div className="flex items-center gap-[16px]">
        <Link href={p.links.notifications} aria-label={p.labels.notifications} className={circle}>
          <MaskIcon name="bell-outline-24" width={20} />
        </Link>
        <Link href={p.links.chat} aria-label={p.labels.chat} className={circle}>
          <MaskIcon name="message" width={20} />
        </Link>
        <Link href={p.links.home} aria-label={p.labels.home} className="text-kink-amber">
          <MaskIcon name="home-solid" width={24} />
        </Link>
        <Link href={p.links.settings} aria-label={p.labels.settings} className="text-pf-icon">
          <MaskIcon name="settings" width={21} />
        </Link>
        <span aria-hidden className="h-[24px] w-px bg-pf-border" />
        <Link
          href={p.links.profile}
          className="flex items-center gap-[8px] text-[13px] font-semibold text-pf-text"
        >
          <AvatarCircle src={p.viewerAvatarUrl} alt="" size={30} ringClassName="bg-pf-border" />
          {p.accountLabel}
        </Link>
      </div>
    </header>
  );
}
