"use client";

import SectionReveal from "@/components/ui/SectionReveal";

const cards = [
  {
    icon: "◈",
    title: "Consent First. Always.",
    body: "At Kinkord, consent, communication, safety and mutual respect are foundational to every interaction within our community.",
  },
  {
    icon: "◉",
    title: "Safe Spaces Matter",
    body: "We encourage informed participation, privacy protection, healthy boundaries and respectful engagement across all community spaces.",
  },
  {
    icon: "◎",
    title: "18+ Verified Community",
    body: "Kinkord is strictly for consenting adults. Every member is age-verified before accessing any community feature.",
  },
];

export default function ConsentSafety() {
  return (
    <section className="py-20 md:py-28 bg-[#080808] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.03)_0%,_transparent_60%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6">
        <SectionReveal className="text-center mb-14">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">
            Our Foundation
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-[#f5f5f0] leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Safety & Consent
          </h2>
          <div className="section-divider mt-4" />
        </SectionReveal>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <SectionReveal key={card.title} delay={i * 0.15}>
              <div className="relative h-full border-l-2 border-[#d4af37]/40 pl-6 pr-4 py-6 bg-[#0d0d0d] hover:border-[#d4af37] hover:bg-[#0f0f0f] transition-all duration-300 group">
                <span className="text-2xl text-[#d4af37]/40 group-hover:text-[#d4af37]/70 transition-colors duration-300 block mb-4">
                  {card.icon}
                </span>
                <h3
                  className="text-lg font-bold text-[#f5f5f0] mb-3 leading-snug"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {card.title}
                </h3>
                <p className="text-sm text-[#888] leading-relaxed">{card.body}</p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
