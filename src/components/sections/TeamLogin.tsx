"use client";

import { Lock } from "lucide-react";
import SectionReveal from "@/components/ui/SectionReveal";
import GoldButton from "@/components/ui/GoldButton";

export default function TeamLogin() {
  return (
    <section className="py-16 bg-[#0d0d0d] border-t border-[#d4af37]/08">
      <div className="max-w-xl mx-auto px-6 text-center">
        <SectionReveal>
          <div className="inline-flex items-center justify-center w-10 h-10 border border-[#d4af37]/25 mb-5">
            <Lock size={16} className="text-[#d4af37]/60" />
          </div>
          <h2
            className="text-xl font-bold text-[#f5f5f0] mb-3"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Team Login
          </h2>
          <p className="text-xs text-[#555] mb-7 leading-relaxed">
            Secure access for administrators, moderators and internal
            management teams.
          </p>
          <GoldButton variant="outline" href="#" size="sm">
            Login
          </GoldButton>
        </SectionReveal>
      </div>
    </section>
  );
}
