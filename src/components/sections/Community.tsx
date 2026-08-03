"use client";

import { motion } from "framer-motion";
import { COMMUNITY_FEATURES } from "@/lib/constants";
import SectionReveal from "@/components/ui/SectionReveal";

export default function Community() {
  return (
    <section className="py-20 md:py-28 bg-[#0d0d0d]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Features list */}
          <div>
            <SectionReveal direction="left">
              <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">
                The Experience
              </p>
              <h2
                className="text-3xl md:text-4xl font-bold text-[#f5f5f0] mb-6 leading-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                Connect Globally
              </h2>
              <div className="section-divider mb-8" style={{ margin: "0 0 2rem 0" }} />
            </SectionReveal>

            <div className="space-y-4">
              {COMMUNITY_FEATURES.map((feature, i) => (
                <motion.div
                  key={feature}
                  className="flex items-center gap-4 group"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] flex-shrink-0 group-hover:scale-150 transition-transform duration-200" />
                  <span className="text-sm text-[#bbb] group-hover:text-[#f5f5f0] transition-colors duration-200">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Phone frame mockup */}
          <SectionReveal direction="right" delay={0.2}>
            <div className="flex justify-center md:justify-end">
              <div className="relative w-[240px] md:w-[260px]">
                {/* Phone outer */}
                <div className="relative border-2 border-[#d4af37]/20 rounded-[2.5rem] p-3 bg-[#0a0a0a] shadow-2xl">
                  {/* Notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-[#1a1a1a] rounded-full" />
                  {/* Screen */}
                  <div className="bg-[#0f0f0f] rounded-[2rem] overflow-hidden pt-6 pb-4 px-3 min-h-[480px]">
                    {/* Mock header */}
                    <div className="flex items-center justify-between mb-4 px-2">
                      <span
                        className="text-[10px] font-bold text-[#d4af37] tracking-widest"
                        style={{ fontFamily: "var(--font-playfair)" }}
                      >
                        KINKORD
                      </span>
                      <div className="w-6 h-6 rounded-full border border-[#d4af37]/30 bg-[#1a1a1a]" />
                    </div>

                    {/* Mock feed items */}
                    {[...Array(4)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="mb-3 border border-[#d4af37]/08 bg-[#131313] rounded-lg p-3"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full bg-[#d4af37]/20" />
                          <div className="h-1.5 bg-[#333] rounded-full flex-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-1 bg-[#222] rounded-full w-full" />
                          <div className="h-1 bg-[#222] rounded-full w-3/4" />
                        </div>
                      </motion.div>
                    ))}

                    {/* Bottom nav mock */}
                    <div className="mt-4 flex justify-around border-t border-[#d4af37]/10 pt-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-5 h-5 bg-[#222] rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Glow beneath phone */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-[#d4af37]/10 blur-xl rounded-full" />
              </div>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
