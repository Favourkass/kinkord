import Image from "next/image";
import Link from "next/link";
import type { PlanPeriod } from "@/domain/subscription";

export type FeatureIcon = "pencil" | "chat" | "gift" | "shield" | "globe" | "ban";

export interface UpgradeOptionVM {
  period: PlanPeriod;
  label: string;
  price: string;
  per: string;
  strike: string | null;
  save: string | null;
  selected: boolean;
}

export interface UpgradeViewProps {
  copy: {
    title: string;
    subtitle: string;
    silverLabel: string;
    crestAlt: string;
    medalAlt: string;
    headline: readonly string[];
    tagline: string;
    features: ReadonlyArray<{ icon: FeatureIcon; title: string; body: string }>;
    gold: { label: string; body: string; medalAlt: string };
    diamond: { label: string; body: string; bodyWide: string; medalAlt: string };
    comingSoon: string;
    slogan: string;
  };
  /** "See all 15 Silver benefits"; null until the full list exists. */
  seeAll: string | null;
  planCard: { title: string; body: string; href: string };
  options: UpgradeOptionVM[];
  onSelect: (period: PlanPeriod) => void;
  cta: { label: string; disabled: boolean; onClick: () => void };
  error: string | null;
}

const icon = (name: string) => `/app/subscription/${name}.svg`;

function Crest({ size, alt }: { size: "phone" | "desktop"; alt: string }) {
  // Figma crops image 1830 into a 16×14 (phone) or 20×19 (desktop) frame, stretched to fit.
  return size === "phone" ? (
    <Image
      src="/app/subscription/silver-crest.png"
      alt={alt}
      width={16}
      height={14}
      className="h-[14px] w-[16px] object-fill"
    />
  ) : (
    <Image
      src="/app/subscription/silver-crest.png"
      alt={alt}
      width={20}
      height={19}
      className="h-[19px] w-[20px] object-fill"
    />
  );
}

/** Monthly/Yearly as radio cards (2:273, 2:278). */
function PhoneOption({ o, onSelect }: { o: UpgradeOptionVM; onSelect: (p: PlanPeriod) => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={o.selected}
      onClick={() => onSelect(o.period)}
      className={`relative flex h-[92px] flex-1 flex-col rounded-[16px] border px-[16px] pt-[17px] text-left ${
        o.selected ? "border-kink-amber bg-sub-gold-tile" : "border-sub-option-line bg-sub-option"
      }`}
    >
      {o.save ? (
        <span className="absolute -top-[10px] right-[12px] flex h-[21px] items-center rounded-[10.5px] bg-kink-amber px-[9px] text-[11px] font-bold text-sub-on-gold">
          {o.save}
        </span>
      ) : null}
      <span className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-sub-soft">{o.label}</span>
        {o.selected ? (
          <span className="mr-[-1px] grid size-[18px] place-items-center rounded-full bg-kink-amber">
            <span className="size-[8px] rounded-full bg-sub-on-gold" />
          </span>
        ) : (
          <span className="size-[17px] rounded-full border border-sub-radio" />
        )}
      </span>
      <span className="mt-[5px] flex items-baseline">
        <span className="font-sora text-[20px] font-bold leading-[1.26] text-sub-text">
          {o.price}
        </span>
        <span className="ml-[7px] text-[13px] text-sub-muted">{o.per}</span>
        {o.strike ? (
          <span className="ml-[6px] text-[13px] text-sub-strike line-through decoration-sub-strike">
            {o.strike}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ComingSoonCard({
  tone,
  medal,
  medalAlt,
  label,
  body,
  pill,
}: {
  tone: "gold" | "diamond";
  medal: string;
  medalAlt: string;
  label: string;
  body: string;
  pill: string;
}) {
  const gold = tone === "gold";
  return (
    <div
      aria-disabled="true"
      className={`flex items-center gap-[14px] rounded-[16px] border py-[12.5px] pl-[16px] pr-[12px] ${
        gold
          ? "border-sub-gold-line bg-sub-gold-card"
          : "border-sub-diamond-line bg-sub-diamond-card"
      }`}
    >
      <Image src={medal} alt={medalAlt} width={34} height={38} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-bold ${gold ? "text-kink-amber" : "text-sub-diamond"}`}>
          {label}
        </p>
        <p className="max-w-[130px] text-[13px] text-sub-muted">{body}</p>
      </div>
      <span
        className={`flex h-[25px] shrink-0 items-center rounded-[12.5px] px-[10px] text-[11px] font-bold text-sub-soft ${
          gold ? "bg-sub-gold-pill" : "bg-sub-diamond-pill"
        }`}
      >
        {pill}
      </span>
      <Image
        src={icon("chevron-right")}
        alt=""
        width={16}
        height={16}
        className="ml-[1px] shrink-0"
      />
    </div>
  );
}

function DesktopComingSoonCard({
  tone,
  medal,
  medalAlt,
  label,
  body,
  pill,
}: {
  tone: "gold" | "diamond";
  medal: string;
  medalAlt: string;
  label: string;
  body: string;
  pill: string;
}) {
  const gold = tone === "gold";
  return (
    <div
      aria-disabled="true"
      className={`flex h-[128px] flex-1 items-center gap-[20px] rounded-[24px] border pl-[28px] pr-[20px] ${
        gold
          ? "border-sub-gold-line bg-sub-gold-card-wide"
          : "border-sub-diamond-line bg-sub-diamond-card-wide"
      }`}
    >
      <Image src={medal} alt={medalAlt} width={64} height={73} className="shrink-0" />
      <div className={`flex min-w-0 shrink flex-col gap-[7px] ${gold ? "w-[219px]" : "w-[222px]"}`}>
        <p className={`text-[14px] font-bold ${gold ? "text-kink-amber" : "text-sub-diamond"}`}>
          {label}
        </p>
        <p className="text-[15px] text-sub-muted">{body}</p>
      </div>
      <span
        className={`flex h-[31px] shrink-0 items-center gap-[6px] rounded-[15.5px] border pl-[12.5px] pr-[13px] text-[12px] font-bold ${
          // 54px after the words on the gold card, 51 on the diamond, as drawn.
          gold
            ? "ml-[34px] border-sub-gold-line bg-sub-gold-pill text-sub-gold-pale"
            : "ml-[31px] border-sub-diamond-line bg-sub-diamond-pill-wide text-sub-diamond"
        }`}
      >
        <Image src={icon(gold ? "lock-gold" : "lock-diamond")} alt="" width={12} height={12} />
        {pill}
      </span>
    </div>
  );
}

function Slogan({ text, wide }: { text: string; wide: boolean }) {
  // As drawn: a short rule, the words, then the second rule pushed to the far edge.
  return wide ? (
    <div className="flex items-center">
      <span className="h-px w-[298.72px] shrink-0 bg-sub-rule" />
      <Image src={icon("crown")} alt="" width={16} height={16} className="ml-[20px] shrink-0" />
      <p className="ml-[20px] whitespace-nowrap text-[12px] font-bold text-sub-slogan">{text}</p>
      <span className="flex-1" />
      <span className="h-px w-[298.73px] shrink-0 bg-sub-rule" />
    </div>
  ) : (
    <div className="flex h-[15px] items-center">
      <span className="h-px w-[22.64px] shrink-0 bg-sub-rule" />
      <p className="ml-[12px] whitespace-nowrap text-[11px] font-bold text-sub-slogan">{text}</p>
      <span className="min-w-[12px] flex-1" />
      <span className="h-px w-[22.64px] shrink-0 bg-sub-rule" />
    </div>
  );
}

/** Upgrade to Silver: phone (Figma 2:179) and desktop (2:2). */
export default function UpgradeView(p: UpgradeViewProps) {
  const { copy } = p;
  const yearly = p.options.find((o) => o.period === "yearly");
  const chosen = p.options.find((o) => o.selected) ?? yearly;
  const error = p.error ? (
    <p role="alert" className="text-center text-[14px] text-sub-danger">
      {p.error}
    </p>
  ) : null;
  const cta = (wide: boolean) => (
    <button
      type="button"
      onClick={p.cta.onClick}
      disabled={p.cta.disabled}
      className={`h-[56px] w-full rounded-[16px] bg-kink-amber font-bold text-sub-on-gold disabled:opacity-50 ${
        wide ? "text-[16px]" : "text-[15px]"
      }`}
    >
      {p.cta.label}
    </button>
  );

  return (
    <>
      {/* Phone */}
      <div className="mt-[4px] flex flex-col gap-[30px] lg:hidden">
        <div className="flex max-w-[346px] flex-col gap-[3px]">
          <h1 className="font-sora text-[28px] font-bold leading-[1.26] text-sub-text">
            {copy.title}
          </h1>
          <p className="text-[15px] text-sub-muted">{copy.subtitle}</p>
        </div>

        <div className="flex flex-col gap-[25px]">
          <Link
            href={p.planCard.href}
            className="flex min-h-[71px] items-center rounded-[16px] border border-sub-card-line bg-sub-card py-[12px] pl-[17px] pr-[16px]"
          >
            <span className="grid size-[37px] shrink-0 place-items-center rounded-full border border-kink-amber">
              <Image src={icon("user")} alt="" width={18} height={18} />
            </span>
            <span className="ml-[14px] min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-sub-text">{p.planCard.title}</span>
              {/* A rejection's reason is the member's to read whole, so it wraps. */}
              <span className="block break-words text-[13px] text-sub-muted">
                {p.planCard.body}
              </span>
            </span>
            <Image
              src={icon("chevron-right-18")}
              alt=""
              width={18}
              height={18}
              className="ml-[8px]"
            />
          </Link>

          <div className="flex flex-col gap-[21px]">
            <section
              id="silver-plans"
              className="scroll-mt-[24px] rounded-[22px] border border-sub-silver-line bg-sub-card px-[20px] pb-[20px] pt-[24px]"
            >
              <div className="flex items-center gap-[14px]">
                <Image
                  src={icon("medal-silver")}
                  alt={copy.medalAlt}
                  width={51}
                  height={62}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-[5px] text-[11px] font-bold text-sub-silver">
                    {copy.silverLabel}
                    <Crest size="phone" alt={copy.crestAlt} />
                  </p>
                  <h2 className="mt-[2px] font-sora text-[20px] font-bold leading-[24px] text-sub-text">
                    {copy.headline[0]}
                    <br />
                    {copy.headline[1]}
                  </h2>
                  <p className="mt-[5px] max-w-[232px] text-[13px] leading-[18px] text-sub-muted">
                    {copy.tagline}
                  </p>
                </div>
              </div>

              <ul className="mt-[24px] grid grid-cols-2 gap-x-[13px] gap-y-[19px]">
                {copy.features.map((f) => (
                  <li key={f.title} className="flex gap-[12px]">
                    <span className="grid size-[36px] shrink-0 place-items-center rounded-[10px] bg-sub-tile">
                      <Image src={icon(`feature-${f.icon}`)} alt="" width={17} height={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-[100px] text-[13px] font-bold text-sub-text">
                        {f.title}
                      </span>
                      <span className="mt-[2px] block max-w-[118px] text-[13px] text-sub-muted">
                        {f.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {p.seeAll ? (
                <p className="mt-[29px] flex items-center justify-center gap-[5px] text-[13px] font-bold text-sub-light">
                  {p.seeAll}
                  <Image src={icon("chevron-right-light")} alt="" width={15} height={15} />
                </p>
              ) : null}

              <div role="radiogroup" className="mt-[29px] flex gap-[13px]">
                {p.options.map((o) => (
                  <PhoneOption key={o.period} o={o} onSelect={p.onSelect} />
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-[12px]">
              <ComingSoonCard
                tone="gold"
                medal={icon("medal-gold")}
                medalAlt={copy.gold.medalAlt}
                label={copy.gold.label}
                body={copy.gold.body}
                pill={copy.comingSoon}
              />
              <ComingSoonCard
                tone="diamond"
                medal={icon("medal-diamond")}
                medalAlt={copy.diamond.medalAlt}
                label={copy.diamond.label}
                body={copy.diamond.body}
                pill={copy.comingSoon}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[30px]">
          <Slogan text={copy.slogan} wide={false} />
          {error}
          {cta(false)}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:block">
        <section className="mt-[36px] flex items-center justify-between rounded-[28px] border border-sub-hero-line bg-sub-hero py-[48px] pl-[38px] pr-[79px]">
          <div className="flex max-w-[601px] flex-col gap-[25px]">
            <div className="flex flex-col gap-[6px]">
              <h1 className="font-sora text-[48px] font-bold leading-[1.26] tracking-[-0.2px] text-sub-text">
                {copy.title}
              </h1>
              <p className="text-[17px] text-sub-muted">{copy.subtitle}</p>
            </div>
            <Link
              href={p.planCard.href}
              className="m-[10px] mr-0 flex min-h-[55px] w-fit items-center gap-[19px] rounded-[27.5px] border border-sub-option-line bg-sub-page-ink/60 py-[8px] pl-[10px] pr-[14px]"
            >
              <span className="flex items-center gap-[13px]">
                <Image src={icon("user-ring")} alt="" width={36} height={36} />
                <span className="w-[211px]">
                  <span className="block text-[14px] font-bold text-sub-text">
                    {p.planCard.title}
                  </span>
                  <span className="block break-words text-[13px] text-sub-muted">
                    {p.planCard.body}
                  </span>
                </span>
              </span>
              <Image src={icon("chevron-right")} alt="" width={16} height={16} />
            </Link>
          </div>
          <Image
            src={icon("medal-silver-hero")}
            alt={copy.medalAlt}
            width={188}
            height={216}
            className="shrink-0"
          />
        </section>

        <div className="mt-[30px] flex items-start gap-[24px]">
          <div className="min-w-0 flex-1">
            <h2 className="font-sora text-[28px] font-bold leading-[1.26] text-sub-text">
              {copy.headline.join(" ")}
            </h2>
            <p className="mt-[8px] text-[15px] text-sub-muted">{copy.tagline}</p>
            <ul className="mt-[21px] grid grid-cols-3 gap-x-[16px] gap-y-[15px]">
              {copy.features.map((f) => (
                <li
                  key={f.title}
                  className="h-[175px] rounded-[20px] border border-sub-feature-line bg-sub-card px-[22px] pt-[22px]"
                >
                  <span className="grid size-[46px] place-items-center rounded-[14px] border border-sub-gold-tile-line bg-sub-gold-tile">
                    <Image src={icon(`feature-${f.icon}`)} alt="" width={20} height={20} />
                  </span>
                  <p className="mt-[16px] max-w-[184px] text-[16px] font-bold leading-[22px] text-sub-text">
                    {f.title}
                  </p>
                  <p className="mt-[4px] max-w-[184px] text-[14px] leading-[20px] text-sub-muted">
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <section className="mt-[3px] w-[340px] shrink-0 rounded-[24px] border border-sub-gold-line bg-sub-card px-[28px] pb-[29px] pt-[27px]">
            <div className="flex items-center gap-[14px]">
              <Image src={icon("medal-silver")} alt={copy.medalAlt} width={43} height={51} />
              <p className="flex w-[133px] items-center justify-between text-[13px] font-bold text-sub-silver">
                {copy.silverLabel}
                <Crest size="desktop" alt={copy.crestAlt} />
              </p>
            </div>
            <div
              role="radiogroup"
              className="mt-[23px] flex h-[54px] items-center rounded-[14px] border border-sub-card-line bg-sub-page-ink p-[4px]"
            >
              {p.options.map((o) => (
                <button
                  key={o.period}
                  type="button"
                  role="radio"
                  aria-checked={o.selected}
                  onClick={() => p.onSelect(o.period)}
                  className={`flex h-[44px] flex-1 items-center justify-center gap-[7px] rounded-[10px] text-[14px] font-bold ${
                    o.selected ? "bg-sub-segment text-sub-text" : "text-sub-muted"
                  }`}
                >
                  {o.label}
                  {o.save ? (
                    <span className="flex h-[19px] items-center rounded-[9.5px] bg-kink-amber px-[7px] text-[11px] text-sub-on-gold">
                      {o.save}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {chosen ? (
              <p className="mt-[14px] flex items-baseline whitespace-nowrap">
                <span className="font-sora text-[48px] font-bold leading-[60px] text-sub-text">
                  {chosen.price}
                </span>
                <span className="ml-[6px] text-[16px] text-sub-muted">{chosen.per}</span>
                {chosen.strike ? (
                  <span className="ml-[6px] text-[16px] text-sub-strike line-through decoration-sub-strike">
                    {chosen.strike}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-[14px] h-[60px]" />
            )}
            {p.error ? <div className="mt-[12px]">{error}</div> : null}
            <div className="mt-[27px]">{cta(true)}</div>
          </section>
        </div>

        {p.seeAll ? (
          <p className="mt-[28px] flex items-center gap-[6px] text-[15px] font-bold text-sub-light">
            {p.seeAll}
            <Image src={icon("chevron-right-light")} alt="" width={16} height={16} />
          </p>
        ) : null}

        <div className="mt-[30px] flex gap-[17px]">
          <DesktopComingSoonCard
            tone="gold"
            medal={icon("medal-gold-large")}
            medalAlt={copy.gold.medalAlt}
            label={copy.gold.label}
            body={copy.gold.body}
            pill={copy.comingSoon}
          />
          <DesktopComingSoonCard
            tone="diamond"
            medal={icon("medal-diamond-large")}
            medalAlt={copy.diamond.medalAlt}
            label={copy.diamond.label}
            body={copy.diamond.bodyWide}
            pill={copy.comingSoon}
          />
        </div>

        <div className="mt-[53px]">
          <Slogan text={copy.slogan} wide />
        </div>
      </div>
    </>
  );
}
