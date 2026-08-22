"use client";

import SectionReveal from "@/components/ui/SectionReveal";
import GoldButton from "@/components/ui/GoldButton";
import type { LandingVM } from "@/presenters/getLandingVM";

type Props = LandingVM["investTeaser"];

export default function Invest({ href, whatsappUrl }: Props) {
  return (
    <section className="py-20 md:py-28 bg-[#080808] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(212,175,55,0.03)_0%,_transparent_50%,_rgba(212,175,55,0.02)_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <SectionReveal>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">Opportunity</p>
          <h2
            className="text-3xl md:text-5xl font-bold text-[#f5f5f0] mb-6 leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Invest in Kinkord
          </h2>
          <div className="section-divider mb-8" />
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <p className="text-sm md:text-base text-[#888] max-w-2xl mx-auto leading-relaxed mb-4">
            Become part of the future of adult lifestyle networking and education.
          </p>
          <p className="text-sm text-[#666] max-w-2xl mx-auto leading-relaxed mb-10">
            Kinkord is opening opportunities for shareholders and strategic investors interested in
            supporting the growth of a global lifestyle platform.
          </p>
        </SectionReveal>

        <SectionReveal delay={0.35}>
          <GoldButton variant="solid" href={href} size="lg">
            Invest With Us
          </GoldButton>
          <p className="text-[10px] text-[#444] mt-6 uppercase tracking-widest">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#d4af37] transition-colors"
            >
              Or connect on WhatsApp
            </a>
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
