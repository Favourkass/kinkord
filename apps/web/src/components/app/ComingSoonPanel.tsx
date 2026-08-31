import Image from "next/image";

export interface ComingSoonPanelProps {
  headline: string;
  constructionLead: string;
  constructionAccent: string;
  subcopy: string;
}

/** The "Coming Soon / under construction" hero used by home and messages. */
export default function ComingSoonPanel({
  headline,
  constructionLead,
  constructionAccent,
  subcopy,
}: ComingSoonPanelProps) {
  const art = "h-[340px] w-[314px] lg:h-[416px] lg:w-[350px]";
  return (
    <section className="flex flex-col items-center text-center">
      <h1 className="text-[36px] font-bold text-kink-gold-bright [text-shadow:0px_4px_12px_var(--app-glow)]">
        {headline}
      </h1>
      <div className={`relative mt-[28px] ${art}`}>
        <Image
          src="/app/construction-light.png"
          alt="Kinkord mascot building the platform"
          fill
          priority
          sizes="350px"
          className="object-contain dark:hidden"
        />
        <Image
          src="/app/construction-dark.png"
          alt="Kinkord mascot building the platform"
          fill
          priority
          sizes="350px"
          className="hidden object-contain dark:block"
        />
      </div>
      <p className="mt-[24px] text-[22px] font-semibold text-app-text">
        {constructionLead} <span className="text-kink-gold-bright">{constructionAccent}</span>
      </p>
      <p className="mt-[10px] w-[263px] text-[13px] font-bold text-app-subtle">{subcopy}</p>
    </section>
  );
}
