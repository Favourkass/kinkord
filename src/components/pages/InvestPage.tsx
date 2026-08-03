"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import SectionReveal from "@/components/ui/SectionReveal";
import GoldButton from "@/components/ui/GoldButton";
import Footer from "@/components/sections/Footer";
import {
  BUSINESS_MODEL,
  CURRENT_POSITION,
  INVESTMENT_STRUCTURE,
  INVESTMENT_TIERS,
  INVEST_WHATSAPP_MESSAGE,
  INVEST_WHATSAPP_URL,
  INVESTOR_BENEFITS,
  OWNERSHIP_EXIT,
  PROBLEMS,
  USE_OF_FUNDS,
  VISION_ITEMS,
} from "@/lib/invest";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-3">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-2xl md:text-3xl font-bold text-[#f5f5f0] mb-4 leading-tight"
      style={{ fontFamily: "var(--font-playfair)" }}
    >
      {children}
    </h2>
  );
}

function GoldCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative border border-[#d4af37]/15 bg-[#0a0a0a] p-6 md:p-8 ${className}`}
    >
      <div className="absolute top-3 left-3 w-5 h-5 border-t border-l border-[#d4af37]/20" />
      <div className="absolute bottom-3 right-3 w-5 h-5 border-b border-r border-[#d4af37]/20" />
      <div className="relative">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-sm text-[#888] leading-relaxed"
        >
          <span className="text-[#d4af37] shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[#d4af37]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ContentSection({
  id,
  label,
  title,
  children,
}: {
  id?: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-14 md:py-16 border-t border-[#d4af37]/10">
      <SectionReveal>
        <SectionLabel>{label}</SectionLabel>
        <SectionTitle>{title}</SectionTitle>
        <div className="section-divider !mx-0 mb-8 w-12" />
      </SectionReveal>
      <SectionReveal delay={0.15}>{children}</SectionReveal>
    </section>
  );
}

export default function InvestPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-[#d4af37]/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#666] hover:text-[#d4af37] transition-colors"
          >
            <ArrowLeft size={14} />
            Home
          </Link>
          <Link
            href="/"
            className="text-sm font-bold tracking-[0.2em] uppercase gold-gradient"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Kinkord
          </Link>
          <a
            href={INVEST_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#d4af37] hover:text-[#f5e27d] transition-colors"
          >
            <MessageCircle size={14} />
            Contact
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.08)_0%,_transparent_60%)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <SectionReveal>
            <SectionLabel>Investment Opportunity</SectionLabel>
            <h1
              className="text-4xl md:text-5xl font-bold text-[#f5f5f0] mb-4 leading-tight"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Invest in Kinkord
            </h1>
            <div className="section-divider mb-8" />
            <p className="text-lg md:text-xl text-[#aaa] leading-relaxed mb-4">
              Building the World&apos;s Largest Kink Community &amp; Ecosystem
            </p>
            <p className="text-sm md:text-base text-[#777] max-w-2xl mx-auto leading-relaxed">
              Kinkord is a next-generation platform designed to unite kinksters
              globally through education, community, entertainment, and
              commerce. We are opening a limited equity investment opportunity
              for members and supporters who believe in the long-term vision of
              Kinkord.
            </p>
          </SectionReveal>
          <SectionReveal delay={0.25} className="mt-10">
            <GoldButton variant="solid" href={INVEST_WHATSAPP_URL} size="lg">
              Invest in Kinkord
            </GoldButton>
            <p className="text-[10px] text-[#555] mt-4 uppercase tracking-widest">
              Connect via WhatsApp with the Kinkord team
            </p>
          </SectionReveal>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 pb-8">
        <ContentSection label="Position" title="Current Position">
          <GoldCard>
            <BulletList items={CURRENT_POSITION} />
          </GoldCard>
        </ContentSection>

        <ContentSection label="Vision" title="Our Vision">
          <p className="text-sm text-[#888] leading-relaxed mb-6">
            Our goal over the next 15 years is to build one of the world&apos;s
            largest kink communities and ecosystems — a global platform that
            becomes the #1 destination for:
          </p>
          <GoldCard>
            <BulletList items={VISION_ITEMS} />
          </GoldCard>
        </ContentSection>

        <ContentSection label="Problem" title="The Problem We Are Solving">
          <p className="text-sm text-[#888] leading-relaxed mb-6">
            Kinkord addresses major gaps in the global kink ecosystem:
          </p>
          <GoldCard>
            <BulletList items={PROBLEMS} />
          </GoldCard>
        </ContentSection>

        <ContentSection label="Structure" title="Investment Structure">
          <GoldCard className="mb-6">
            <BulletList items={INVESTMENT_STRUCTURE} />
          </GoldCard>
          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="border border-[#d4af37]/15 p-4 bg-[#080808]">
              <p className="text-[#d4af37] font-semibold uppercase tracking-wider mb-1">
                Minimum
              </p>
              <p className="text-[#f5f5f0] text-lg font-bold">$10</p>
            </div>
            <div className="border border-[#d4af37]/15 p-4 bg-[#080808]">
              <p className="text-[#d4af37] font-semibold uppercase tracking-wider mb-1">
                Max per investor
              </p>
              <p className="text-[#f5f5f0] text-lg font-bold">20%</p>
            </div>
          </div>
        </ContentSection>

        <ContentSection label="Tiers" title="Investment Tiers">
          <div className="grid gap-3 sm:grid-cols-2">
            {INVESTMENT_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="border border-[#d4af37]/15 bg-[#080808] p-5 relative overflow-hidden group hover:border-[#d4af37]/35 transition-colors"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tier.accent}`}
                />
                <p
                  className="text-lg font-bold text-[#f5f5f0] mb-1"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {tier.name}
                </p>
                <p className="text-sm text-[#d4af37]">{tier.range}</p>
              </div>
            ))}
          </div>
        </ContentSection>

        <ContentSection label="Benefits" title="Investor Benefits">
          <GoldCard>
            <BulletList items={INVESTOR_BENEFITS} />
          </GoldCard>
        </ContentSection>

        <ContentSection label="Revenue" title="Business Model">
          <GoldCard>
            <BulletList items={BUSINESS_MODEL} />
          </GoldCard>
        </ContentSection>

        <ContentSection label="Allocation" title="Use of Funds">
          <div className="space-y-4">
            {USE_OF_FUNDS.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5 gap-4">
                  <span className="text-[#888] leading-snug">{item.label}</span>
                  <span className="text-[#d4af37] font-semibold shrink-0">
                    {item.pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8b6914] to-[#d4af37]"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ContentSection>

        <ContentSection label="Exit" title="Ownership & Exit">
          <GoldCard>
            <BulletList items={OWNERSHIP_EXIT} />
          </GoldCard>
        </ContentSection>

        <ContentSection label="Trust" title="Founder Message">
          <GoldCard className="text-center">
            <p className="text-sm text-[#888] leading-relaxed mb-2">
              A short founder pitch video helps investors understand the vision
              and builds trust.
            </p>
            <p className="text-xs text-[#555] uppercase tracking-widest">
              Video coming soon
            </p>
          </GoldCard>
        </ContentSection>

        <section className="py-14 md:py-16 border-t border-[#d4af37]/10">
          <SectionReveal>
            <SectionLabel>Movement</SectionLabel>
            <SectionTitle>Join the Movement</SectionTitle>
            <div className="section-divider !mx-0 mb-8 w-12" />
            <p className="text-sm md:text-base text-[#888] leading-relaxed mb-2">
              We are not just building a platform.
            </p>
            <p className="text-base md:text-lg text-[#f5f5f0] leading-relaxed">
              We are building a global ecosystem owned by its community.
            </p>
          </SectionReveal>
        </section>

        {/* Risk notice */}
        <section className="py-8">
          <div className="border border-[#444]/30 bg-[#080808] p-6 md:p-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#666] mb-3">
              Risk Notice
            </p>
            <p className="text-xs text-[#666] leading-relaxed">
              All investments carry risk, and returns are not guaranteed. The
              value of equity may increase or decrease depending on the
              performance and growth of Kinkord. Please invest only what you
              are comfortable committing to long-term growth participation.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section
          id="invest-cta"
          className="py-16 md:py-20 text-center border-t border-[#d4af37]/10"
        >
          <SectionReveal>
            <SectionLabel>Next Step</SectionLabel>
            <SectionTitle>Express Your Interest</SectionTitle>
            <div className="section-divider mb-8" />
            <p className="text-sm text-[#888] max-w-lg mx-auto leading-relaxed mb-8">
              Click below to join the investment process. You will be redirected
              to WhatsApp to connect directly with the Kinkord team.
            </p>
            <GoldButton variant="solid" href={INVEST_WHATSAPP_URL} size="lg">
              Invest in Kinkord
            </GoldButton>
            <div className="mt-8 max-w-md mx-auto border border-[#d4af37]/10 bg-[#080808] p-4 text-left">
              <p className="text-[10px] uppercase tracking-widest text-[#555] mb-2">
                WhatsApp message (auto-sent)
              </p>
              <p className="text-sm text-[#aaa] italic">
                &ldquo;{INVEST_WHATSAPP_MESSAGE}&rdquo;
              </p>
            </div>
          </SectionReveal>
        </section>

        {/* Team */}
        <section className="py-10 text-center border-t border-[#d4af37]/10">
          <p className="text-sm text-[#888]">Kinkord Team</p>
          <p className="text-[10px] uppercase tracking-widest text-[#555] mt-1">
            Registered Company
          </p>
          <p
            className="text-base text-[#f5f5f0] mt-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Founder &amp; CEO — Tega Maxwell
          </p>
        </section>
      </div>

      <Footer />
    </main>
  );
}
