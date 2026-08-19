"use client";

import SectionReveal from "@/components/ui/SectionReveal";
import GoldButton from "@/components/ui/GoldButton";

export default function About() {
  return (
    <section id="about" className="py-20 md:py-28 bg-[#0d0d0d]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <SectionReveal>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">
            Our Story
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-[#f5f5f0] mb-6"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            About Kinkord
          </h2>
          <div className="section-divider mb-10" />
        </SectionReveal>

        <SectionReveal delay={0.2}>
          {/* Glass card */}
          <div className="relative border border-[#d4af37]/15 bg-[#0a0a0a] p-8 md:p-12">
            <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#d4af37]/20" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#d4af37]/20" />

            <p className="text-sm md:text-base text-[#888] leading-relaxed mb-8">
              Kinkord is more than a platform — it is a movement toward safer,
              more informed adult lifestyle spaces. Built with privacy, dignity
              and education at the core, Kinkord brings together a verified
              global community of adults committed to consent-first exploration.
            </p>
            <p className="text-xs text-[#555] mb-8 leading-relaxed">
              Learn more about our mission, community structure, values and
              future vision.
            </p>

            <GoldButton variant="outline" href="#" size="md">
              Read More
            </GoldButton>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
