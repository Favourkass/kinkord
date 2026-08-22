"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import SectionReveal from "@/components/ui/SectionReveal";
import type { LandingVM } from "@/presenters/getLandingVM";

type Props = LandingVM["stats"];
type Stat = Props["stats"][number];

function useCountUp(target: number, active: boolean, duration = 1800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
}

function StatCard({ stat, index, active }: { stat: Stat; index: number; active: boolean }) {
  const count = useCountUp(stat.value, active);
  return (
    <motion.div
      className="flex flex-col items-center text-center border border-[#d4af37]/10 p-6 bg-[#0d0d0d] hover:border-[#d4af37]/30 transition-colors duration-300"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <span
        className="text-4xl md:text-5xl font-bold gold-gradient"
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {count}
        {stat.suffix}
      </span>
      <span className="text-[11px] uppercase tracking-widest text-[#999] mt-2">{stat.label}</span>
    </motion.div>
  );
}

export default function Stats({ eyebrow, stats, countriesLabel, countries }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 md:py-28 bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.04)_0%,_transparent_60%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6">
        <SectionReveal className="text-center mb-12">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">{eyebrow}</p>
          <div className="section-divider" />
        </SectionReveal>

        <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} active={inView} />
          ))}
        </div>

        <SectionReveal className="mt-12 text-center" delay={0.3}>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#999] mb-4">
            {countriesLabel}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {countries.map((country) => (
              <span
                key={country}
                className="text-xs px-4 py-1.5 border border-[#d4af37]/25 text-[#d4af37] uppercase tracking-widest hover:bg-[#d4af37]/10 transition-colors duration-200 cursor-default"
              >
                {country}
              </span>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
