"use client";

import { motion } from "framer-motion";
import { EDUCATION_TOPICS } from "@/lib/constants";
import SectionReveal from "@/components/ui/SectionReveal";

export default function Education() {
  return (
    <section className="py-20 md:py-28 bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6">
        <SectionReveal className="text-center mb-14">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">
            Grow With Us
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-[#f5f5f0] mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Lectures & Education
          </h2>
          <div className="section-divider mb-6" />
          <p className="text-sm text-[#888] max-w-xl mx-auto">
            Explore lectures, discussions and educational resources covering
            every aspect of the lifestyle.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {EDUCATION_TOPICS.map((topic, i) => (
            <motion.div
              key={topic}
              className="group border border-[#d4af37]/15 p-4 md:p-5 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5 transition-all duration-300 cursor-default"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -3 }}
            >
              <div className="w-1 h-4 bg-[#d4af37]/30 group-hover:bg-[#d4af37] transition-colors duration-300 mb-3" />
              <p className="text-xs text-[#ccc] group-hover:text-[#f5f5f0] leading-snug transition-colors duration-200">
                {topic}
              </p>
            </motion.div>
          ))}
        </div>

        <SectionReveal className="text-center mt-12" delay={0.4}>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d4af37]/60">
            Knowledge. Safety. Expression.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
