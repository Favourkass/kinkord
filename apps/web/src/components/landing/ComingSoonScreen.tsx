import Image from "next/image";
import Link from "next/link";
import AgePill from "@/components/ui/AgePill";

export interface ComingSoonScreenProps {
  logo: { src: string; alt: string };
  title: string;
  note: string;
  back: { label: string; href: string };
  ageDisclaimer?: { lead: string; rest: string };
}

export default function ComingSoonScreen({
  logo,
  title,
  note,
  back,
  ageDisclaimer,
}: ComingSoonScreenProps) {
  return (
    <div className="min-h-dvh bg-black">
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-[27px] text-center">
        <Image src={logo.src} alt={logo.alt} width={98} height={98} priority unoptimized />
        <h1 className="text-[32px] font-extrabold leading-tight text-kink-gold-bright lg:text-[48px]">
          {title}
        </h1>
        <p className="max-w-[420px] text-[15px] font-semibold text-kink-mist lg:text-[20px]">
          {note}
        </p>
        <Link
          href={back.href}
          className="mt-2 flex h-[60px] w-full max-w-[347px] items-center justify-center rounded-[10px] border border-kink-amber text-[20px] font-bold text-kink-gold-bright"
        >
          {back.label}
        </Link>
        {ageDisclaimer && (
          <div className="w-full max-w-[347px] lg:max-w-[480px]">
            <AgePill lead={ageDisclaimer.lead} rest={ageDisclaimer.rest} compact />
          </div>
        )}
      </main>
    </div>
  );
}
