import type { PublicProfileVM } from "@/domain/member";

export interface AboutTabLabels {
  bio: string;
  basicInfo: string;
  age: string;
  gender: string;
  orientation: string;
  relationship: string;
  bodyType: string;
  interests: string;
  lookingFor: string;
  languages: string;
  joined: string;
  notShared: string;
}

export interface AboutTabProps {
  vm: PublicProfileVM;
  labels: AboutTabLabels;
}

/** About tab: bio, basic info rows, interests / looking-for chips, languages, joined. */
export default function AboutTab({ vm, labels }: AboutTabProps) {
  const heading = (text: string) => (
    <h2 className="pb-[8px] text-[12px] font-bold uppercase tracking-[2px] text-kink-amber">
      {text}
    </h2>
  );
  const row = (label: string, value: string | null) => (
    <div className="flex items-center justify-between gap-[12px] border-b border-app-line py-[10px] last:border-b-0">
      <span className="text-[14px] text-app-subtle">{label}</span>
      <span
        className={`text-right text-[14px] font-semibold ${value ? "text-app-text" : "text-app-muted"}`}
      >
        {value ?? labels.notShared}
      </span>
    </div>
  );
  const chips = (items: string[]) => (
    <ul className="flex flex-wrap gap-[8px]">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-kink-amber/50 bg-app-members px-[12px] py-[5px] text-[13px] font-medium text-app-name"
        >
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-[22px] px-[16px] pt-[20px]">
      <section>
        {heading(labels.bio)}
        <p className={`text-[15px] leading-relaxed ${vm.bio ? "text-app-text" : "text-app-muted"}`}>
          {vm.bio ?? labels.notShared}
        </p>
      </section>
      <section>
        {heading(labels.basicInfo)}
        <div className="rounded-[14px] border border-app-card-border bg-app-card px-[14px]">
          {row(labels.age, vm.basic.age)}
          {row(labels.gender, vm.basic.gender)}
          {row(labels.orientation, vm.basic.orientation)}
          {row(labels.relationship, vm.basic.relationshipStatus)}
          {row(labels.bodyType, vm.basic.bodyType)}
        </div>
      </section>
      {vm.interests.length > 0 && (
        <section>
          {heading(labels.interests)}
          {chips(vm.interests)}
        </section>
      )}
      {vm.lookingFor.length > 0 && (
        <section>
          {heading(labels.lookingFor)}
          {chips(vm.lookingFor)}
        </section>
      )}
      <section>
        <div className="rounded-[14px] border border-app-card-border bg-app-card px-[14px]">
          {row(labels.languages, vm.languages)}
          {row(labels.joined, vm.joined)}
        </div>
      </section>
    </div>
  );
}
