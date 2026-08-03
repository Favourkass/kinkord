"use client";

import { motion } from "framer-motion";
import GoldParticles from "@/components/ui/GoldParticles";
import CountdownTimer from "@/components/ui/CountdownTimer";
import GoldButton from "@/components/ui/GoldButton";

export default function FinalCTA() {
  return (
    <section
      id="join"
      className="relative min-h-[70vh] flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a]"
    >
      <GoldParticles />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.07)_0%,_transparent_65%)] pointer-events-none" style={{ zIndex: 2 }} />

      <div
        className="relative flex flex-col items-center text-center px-6 py-20 gap-8 max-w-2xl mx-auto"
        style={{ zIndex: 3 }}
      >
        <motion.p
          className="text-[10px] uppercase tracking-[0.5em] text-[#d4af37]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          Be First
        </motion.p>

        <motion.h2
          className="text-4xl md:text-6xl font-bold text-[#f5f5f0] leading-tight"
          style={{ fontFamily: "var(--font-playfair)" }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          The Community
          <br />
          <span className="gold-gradient">Is Coming.</span>
        </motion.h2>

        <motion.p
          className="text-sm md:text-base uppercase tracking-[0.3em] text-[#888]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.25 }}
        >
          Join the Movement
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="border border-[#d4af37]/20 px-6 py-4 bg-[#0a0a0a]/60 backdrop-blur-sm"
        >
          <CountdownTimer size="lg" />
          <p className="text-[10px] text-[#999] tracking-widest uppercase mt-3">
            July 3, 2027
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <GoldButton variant="solid" href="#" size="lg">
            Join Kinkord
          </GoldButton>
        </motion.div>
      </div>
    </section>
  );
}
