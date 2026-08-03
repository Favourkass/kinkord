"use client";

import { motion } from "framer-motion";
import GoldParticles from "@/components/ui/GoldParticles";
import CountdownTimer from "@/components/ui/CountdownTimer";
import GoldButton from "@/components/ui/GoldButton";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Particles */}
      <GoldParticles />

      {/* Background image placeholder with gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 2 }}
        aria-hidden="true"
      >
        {/* Replace this div's background with a real image via inline style or next/image */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-[#0a0a0a]/40 to-[#0a0a0a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.06)_0%,_transparent_70%)]" />
      </div>

      {/* Content */}
      <div
        className="relative flex flex-col items-center text-center px-6 py-24 w-full max-w-3xl mx-auto gap-6"
        style={{ zIndex: 3 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1
            className="text-5xl md:text-6xl font-bold tracking-[0.25em] uppercase gold-gradient"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            KINKORD
          </h1>
          <div className="section-divider mt-3" />
        </motion.div>

        {/* Coming Soon label */}
        <motion.p
          className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          Coming Soon
        </motion.p>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="border border-[#d4af37]/20 px-6 py-4 bg-[#0a0a0a]/60 backdrop-blur-sm"
        >
          <CountdownTimer size="lg" />
          <p className="text-[10px] text-[#999] tracking-widest uppercase mt-3">
            Launching December 28, 2027
          </p>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.7 }}
          className="space-y-4"
        >
          <h2
            className="text-3xl md:text-5xl font-bold text-[#f5f5f0] leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Welcome to Kinkord
          </h2>
          <p className="text-sm md:text-base text-[#bbb] max-w-xl mx-auto leading-relaxed">
            A global luxury lifestyle community for adults built on consent,
            education, connection and expression.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          <GoldButton variant="solid" href="#join" size="lg">
            Join Kinkord
          </GoldButton>
          <GoldButton variant="outline" href="#about" size="lg">
            Explore More
          </GoldButton>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ zIndex: 3 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        <span className="text-[9px] uppercase tracking-widest text-[#d4af37]/50">
          Scroll
        </span>
        <motion.div
          className="w-px h-8 bg-gradient-to-b from-[#d4af37]/40 to-transparent"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "top" }}
        />
      </motion.div>
    </section>
  );
}
