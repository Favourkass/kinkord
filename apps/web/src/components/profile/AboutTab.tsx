import type { ReactNode } from "react";
import MaskIcon from "@/components/app/MaskIcon";
import type { PublicProfileVM, SocialPlatform } from "@/domain/member";

export interface AboutLabels {
  aboutMe: string;
  personal: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  location: string;
  relationship: string;
  nationality: string;
  occupation: string;
  languages: string;
  roles: string;
  kinks: string;
  lookingFor: string;
  limits: string;
  groups: string;
  noGroups: string;
  social: string;
  noSocial: string;
  platforms: Record<SocialPlatform, string>;
  verification: string;
  verified: { basic: string; none: string };
  verifiedDetail: (email: boolean, phone: boolean) => string;
  tagline: string;
  memberSince: (date: string) => string;
  notShared: string;
  privateNotice: string;
}

export interface AboutTabProps {
  vm: PublicProfileVM;
  labels: AboutLabels;
}

const ICONS = {
  aboutMe: "/app/profile/about-me.svg",
  personal: "/app/profile/about-personal.svg",
  age: "/app/profile/about-age.svg",
  dateOfBirth: "/app/profile/about-dob.svg",
  gender: "/app/profile/about-gender.svg",
  location: "/app/profile/about-location.svg",
  relationship: "/app/profile/about-relationship.svg",
  nationality: "/app/profile/about-nationality.svg",
  occupation: "/app/profile/about-occupation.svg",
  languages: "/app/profile/about-language.svg",
  roles: "/app/profile/about-roles.svg",
  kinks: "/app/profile/about-kinks.svg",
  lookingFor: "/app/profile/about-looking-for.svg",
  limits: "/app/profile/about-limits.svg",
  groups: "/app/profile/about-groups.svg",
  social: "/app/profile/about-social.svg",
  verification: "/app/profile/about-verification.svg",
  chevron: "/app/profile/icon-chevron-right-16.svg",
  facebook: "/app/profile/icon-facebook.svg",
  x: "/app/profile/icon-x.svg",
  verified: "/app/profile/icon-verified.svg",
  crown: "/app/profile/icon-crown.svg",
} as const;

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[12px] rounded-[16px] border border-pf-card-border bg-pf-card p-[16px]">
      <header className="flex items-center gap-[10px]">
        <span className="grid size-[32px] shrink-0 place-items-center rounded-full border border-kink-gold-bright/20 bg-pf-surface-2 text-kink-gold-bright">
          <MaskIcon src={icon} width={16} />
        </span>
        <h2 className="flex-1 text-[14px] font-semibold text-pf-text">{title}</h2>
        <MaskIcon src={ICONS.chevron} width={16} className="text-pf-muted" />
      </header>
      {children}
    </section>
  );
}

function Tags({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-[8px]">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-kink-gold-bright bg-kink-gold-bright/5 px-[12px] py-[4px] text-[12px] font-semibold text-kink-gold-bright"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * About tab (Figma 1256:800 + Profile Sections Design): About Me, Personal Information rows,
 * Roles / Kinks / Looking For tags, Limits, Groups, Social Links, Verification, "Member since".
 * Nothing here is editable — everything changes through Edit Profile (CEO, 2026-09-12).
 */
export default function AboutTab({ vm, labels }: AboutTabProps) {
  const row = (icon: string, label: string, value: string | null) => (
    <div
      key={label}
      className="flex items-center gap-[10px] border-b border-pf-divider py-[10px] last:border-b-0"
    >
      <MaskIcon src={icon} width={15} className="shrink-0 text-kink-gold-bright" />
      <span className="flex-1 text-[14px] text-pf-muted">{label}</span>
      <span
        className={`text-right text-[14px] font-medium ${value ? "text-pf-text" : "text-pf-muted"}`}
      >
        {value ?? labels.notShared}
      </span>
    </div>
  );

  const footer = (
    <div className="flex flex-col items-center gap-[6px] pt-[8px] text-center">
      <MaskIcon src={ICONS.crown} width={24} className="text-kink-gold-bright" />
      <p className="text-[12px] italic text-pf-muted">{labels.tagline}</p>
      {vm.memberSince ? (
        <p className="text-[12px] text-pf-text">{labels.memberSince(vm.memberSince)}</p>
      ) : null}
    </div>
  );

  if (vm.restricted) {
    return (
      <div className="flex flex-col gap-[16px] px-[16px] pb-[40px] pt-[16px] lg:p-0">
        <div className="rounded-[16px] border border-pf-card-border bg-pf-card p-[16px] text-[13px] text-pf-muted">
          {labels.privateNotice}
        </div>
        {footer}
      </div>
    );
  }

  const p = vm.personal;
  return (
    <div className="flex flex-col gap-[16px] px-[16px] pb-[40px] pt-[16px] lg:p-0">
      <Card icon={ICONS.aboutMe} title={labels.aboutMe}>
        <p className={`text-[14px] leading-[1.5] ${vm.bio ? "text-pf-body" : "text-pf-muted"}`}>
          {vm.bio ?? labels.notShared}
        </p>
      </Card>

      <Card icon={ICONS.personal} title={labels.personal}>
        <div className="flex flex-col">
          {row(ICONS.age, labels.age, p.age)}
          {p.dateOfBirth ? row(ICONS.dateOfBirth, labels.dateOfBirth, p.dateOfBirth) : null}
          {row(ICONS.gender, labels.gender, p.gender)}
          {row(ICONS.location, labels.location, p.location)}
          {row(ICONS.relationship, labels.relationship, p.relationshipStatus)}
          {row(ICONS.nationality, labels.nationality, p.nationality)}
          {row(ICONS.occupation, labels.occupation, p.occupation)}
          {row(ICONS.languages, labels.languages, p.languages)}
        </div>
      </Card>

      {vm.roles.length > 0 ? (
        <Card icon={ICONS.roles} title={labels.roles}>
          <Tags items={vm.roles} />
        </Card>
      ) : null}
      {vm.interests.length > 0 ? (
        <Card icon={ICONS.kinks} title={labels.kinks}>
          <Tags items={vm.interests} />
        </Card>
      ) : null}
      {vm.lookingFor.length > 0 ? (
        <Card icon={ICONS.lookingFor} title={labels.lookingFor}>
          <Tags items={vm.lookingFor} />
        </Card>
      ) : null}
      {vm.limits ? (
        <Card icon={ICONS.limits} title={labels.limits}>
          <p className="text-[14px] leading-[1.5] text-pf-body">{vm.limits}</p>
        </Card>
      ) : null}

      <Card icon={ICONS.groups} title={labels.groups}>
        <p className="text-[13px] text-pf-muted">{labels.noGroups}</p>
      </Card>

      <Card icon={ICONS.social} title={labels.social}>
        {vm.socialLinks.length === 0 ? (
          <p className="text-[13px] text-pf-muted">{labels.noSocial}</p>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {vm.socialLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-[12px] rounded-[12px] border border-pf-border bg-pf-surface-2 p-[12px]"
              >
                <span
                  className={`grid size-[36px] shrink-0 place-items-center rounded-full text-white ${
                    link.platform === "facebook"
                      ? "bg-[#1877f2]"
                      : "border border-[#333333] bg-black"
                  }`}
                >
                  <MaskIcon src={ICONS[link.platform]} width={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-semibold text-pf-text">
                    {labels.platforms[link.platform]}
                  </span>
                  <span className="truncate text-[12px] text-pf-muted">{link.handle}</span>
                </span>
                <MaskIcon src={ICONS.chevron} width={16} className="text-pf-muted" />
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card icon={ICONS.verification} title={labels.verification}>
        <div className="flex items-center gap-[12px] rounded-[12px] border border-kink-gold-bright/30 bg-kink-gold-bright/10 p-[12px]">
          <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-kink-gold-bright text-black">
            <MaskIcon src={ICONS.verified} width={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold text-pf-text">
              {labels.verified[vm.verification.level]}
            </span>
            <span className="text-[12px] text-pf-muted">
              {labels.verifiedDetail(vm.verification.email, vm.verification.phone)}
            </span>
          </span>
        </div>
      </Card>

      {footer}
    </div>
  );
}
