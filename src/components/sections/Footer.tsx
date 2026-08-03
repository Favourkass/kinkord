"use client";

import { Send, MessageCircle, Music2, AtSign, Hash } from "lucide-react";
import type { LandingVM } from "@/presenters/getLandingVM";

type Props = LandingVM["footer"];

const SOCIAL_ICONS: Record<string, typeof AtSign> = {
  Instagram: AtSign,
  "X / Twitter": Hash,
  TikTok: Music2,
  Telegram: Send,
  WhatsApp: MessageCircle,
};

export default function Footer({ links, socials }: Props) {
  return (
    <footer className="bg-[#080808] border-t border-[#d4af37]/10 py-14 px-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
        <div className="text-center">
          <h3
            className="text-2xl font-bold tracking-[0.3em] uppercase gold-gradient"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            KINKORD
          </h3>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#555] mt-2">
            Global Lifestyle Community for Adults
          </p>
        </div>

        <div className="section-divider w-16" />

        <div className="flex items-center gap-5">
          {socials.map(({ name, href }) => {
            const Icon = SOCIAL_ICONS[name] ?? AtSign;
            return (
              <a
                key={name}
                href={href}
                aria-label={name}
                className="w-9 h-9 border border-[#d4af37]/15 flex items-center justify-center text-[#888] hover:text-[#d4af37] hover:border-[#d4af37]/50 transition-all duration-200"
              >
                <Icon size={15} />
              </a>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[10px] uppercase tracking-widest text-[#555] hover:text-[#d4af37] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        <p className="text-[10px] text-[#333] tracking-widest uppercase">
          &copy; Kinkord 2026. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
