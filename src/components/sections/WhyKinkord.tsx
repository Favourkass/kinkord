"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import SectionReveal from "@/components/ui/SectionReveal";
import type { LandingVM } from "@/presenters/getLandingVM";

type Props = LandingVM["why"];

export default function WhyKinkord({ eyebrow, title, features, footnote }: Props) {
  return (
    <section className="py-20 md:py-28 bg-[#0d0d0d]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <SectionReveal direction="left">
            <div className="relative aspect-[4/5] bg-[#111] border border-[#d4af37]/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 via-transparent to-[#d4af37]/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[#d4af37]/20 text-sm uppercase tracking-widest">
                  Editorial Visual
                </span>
              </div>
              <div className="absolute top-4 left-4 w-8 h-8 border-t border-l border-[#d4af37]/30" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b border-r border-[#d4af37]/30" />
            </div>
          </SectionReveal>

          <div>
            <SectionReveal direction="right">
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">
                {eyebrow}
              </p>
              <h2
                className="text-3xl md:text-4xl font-bold text-[#f5f5f0] mb-6 leading-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {title}
              </h2>
              <div className="section-divider mb-8" style={{ margin: "0 0 2rem 0" }} />
            </SectionReveal>

            <div className="space-y-3">
              {features.map((feature, i) => (
                <motion.div
                  key={feature}
                  className="flex items-center gap-3 group"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full border border-[#d4af37]/40 flex items-center justify-center group-hover:border-[#d4af37] group-hover:bg-[#d4af37]/10 transition-all duration-200">
                    <Check size={10} className="text-[#d4af37]" />
                  </span>
                  <span className="text-sm text-[#ccc] group-hover:text-[#f5f5f0] transition-colors duration-200">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>

            <SectionReveal delay={0.8} className="mt-8">
              <p className="text-xs text-[#666] leading-relaxed italic border-l-2 border-[#d4af37]/30 pl-4">
                {footnote}
              </p>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
