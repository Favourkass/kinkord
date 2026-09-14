"use client";

import { Send, MessageCircle, Music2, AtSign, Hash } from "lucide-react";
import type { ComponentType } from "react";
import type { FooterVM } from "@/presenters/getFooterVM";

type Props = FooterVM;

function FacebookIcon({ size = 15, className }: { size?: number | string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<
  string,
  ComponentType<{ size?: number | string; className?: string }>
> = {
  Facebook: FacebookIcon,
  Instagram: AtSign,
  "X / Twitter": Hash,
  TikTok: Music2,
  Telegram: Send,
  WhatsApp: MessageCircle,
};

export default function Footer({ links, socials, addressLine, ageDisclaimer }: Props) {
  return (
    <footer className="bg-[#080808] border-t border-[#d4af37]/10 py-14 px-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
        <div className="text-center flex flex-col items-center">
          <h3
            className="text-2xl font-bold tracking-[0.3em] uppercase gold-gradient"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            KINKORD
          </h3>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#555] mt-2">
            Global Lifestyle Community for Adults
          </p>
          {ageDisclaimer && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/25 bg-[#d4af37]/5 px-3.5 py-1 text-[10px] sm:text-[11px] text-[#d4af37]">
              <span className="font-bold tracking-wider">18+</span>
              <span className="text-[#666]">·</span>
              <span className="text-[#bbb] font-medium">{ageDisclaimer}</span>
            </div>
          )}
        </div>

        <div className="section-divider w-16" />

        <div className="flex items-center gap-5">
          {socials.map(({ name, href }) => {
            const Icon = SOCIAL_ICONS[name] ?? AtSign;

            // No URL yet (presenter passes href: null) — dimmed icon, not a link.
            if (!href) {
              return (
                <span
                  key={name}
                  role="img"
                  aria-label={name}
                  className="w-9 h-9 border border-[#d4af37]/10 flex items-center justify-center text-[#555] cursor-default select-none opacity-60"
                >
                  <Icon size={15} />
                </span>
              );
            }

            return (
              <a
                key={name}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
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

        <p className="text-[11px] text-[#555] tracking-widest text-center">{addressLine}</p>

        <p className="text-[10px] text-[#333] tracking-widest uppercase">
          &copy; Kinkord 2026. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
