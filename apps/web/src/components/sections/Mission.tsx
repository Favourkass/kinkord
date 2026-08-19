"use client";

import { motion } from "framer-motion";
import SectionReveal from "@/components/ui/SectionReveal";

export default function Mission() {
  return (
    <section className="py-24 md:py-32 bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.04)_0%,_transparent_65%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <SectionReveal>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-8">
            Our Purpose
          </p>
        </SectionReveal>

        <SectionReveal delay={0.15}>
          <div className="relative">
            {/* Large decorative quote */}
            <span
              className="absolute -top-6 left-0 text-7xl text-[#d4af37]/08 leading-none select-none"
              aria-hidden="true"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              &ldquo;
            </span>

            <h2
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#f5f5f0] leading-relaxed relative z-10"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              To create safer, informed and globally connected spaces where
              adults can explore lifestyle expression, education, networking
              and community through respect, consent and privacy.
            </h2>

            <span
              className="absolute -bottom-8 right-0 text-7xl text-[#d4af37]/08 leading-none select-none"
              aria-hidden="true"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              &rdquo;
            </span>
          </div>
        </SectionReveal>

        <SectionReveal delay={0.4} className="mt-10">
          <div className="section-divider" />
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37]/50 mt-6">
            Our Mission
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
