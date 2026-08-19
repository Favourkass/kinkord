import { notFound } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/sections/Footer";
import SectionReveal from "@/components/ui/SectionReveal";
import GoldButton from "@/components/ui/GoldButton";
import type { Metadata } from "next";
import { Routes } from "@/constants/Routes";
import { getLandingVM } from "@/presenters/getLandingVM";
import * as lectureService from "@/services/lecture.service";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const lecture = await lectureService.getLectureVmBySlug(slug);
    if (!lecture) return {};
    return {
      title: `${lecture.title} — Kinkord Education`,
      description: lecture.body.slice(0, 160),
    };
  } catch {
    return {};
  }
}

export async function generateStaticParams() {
  try {
    const lectures = await lectureService.listPublishedLectures();
    return lectures.map((l) => ({ slug: l.slug }));
  } catch {
    return [];
  }
}

export default async function LectureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { footer } = getLandingVM();

  let lecture = null;
  try {
    lecture = await lectureService.getLectureVmBySlug(slug);
  } catch {
    // sheets not configured
  }

  if (!lecture || !lecture.published) notFound();

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <Link
          href={Routes.lectures}
          className="text-[10px] uppercase tracking-widest text-[#555] hover:text-[#d4af37] transition-colors"
        >
          ← All Lectures
        </Link>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        <SectionReveal>
          <span className="text-[9px] uppercase tracking-[0.4em] text-[#d4af37] mb-4 block">
            {lecture.category}
          </span>
          <h1
            className="text-3xl md:text-4xl font-bold text-[#f5f5f0] leading-tight mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {lecture.title}
          </h1>
          <div className="flex items-center gap-4 text-[10px] text-[#444] uppercase tracking-wider mb-8">
            <span>{lecture.createdAtLabel}</span>
          </div>
          <div className="section-divider mb-10" style={{ margin: "0 0 2.5rem 0" }} />
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <div className="space-y-5">
            {lecture.paragraphs.map((para, i) => (
              <p key={i} className="text-[#aaa] text-sm md:text-base leading-[1.9]">
                {para}
              </p>
            ))}
          </div>
        </SectionReveal>

        {lecture.links.length > 0 && (
          <SectionReveal delay={0.2} className="mt-12">
            <div className="border-t border-[#d4af37]/10 pt-8">
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#555] mb-5">
                Resources & Links
              </p>
              <div className="flex flex-wrap gap-3">
                {lecture.links.map((link, i) => (
                  <GoldButton key={i} variant="outline" href={link.url} size="sm">
                    {link.label}
                  </GoldButton>
                ))}
              </div>
            </div>
          </SectionReveal>
        )}

        <SectionReveal delay={0.3} className="mt-16 pt-8 border-t border-[#d4af37]/08">
          <div className="flex items-center justify-between">
            <Link
              href={Routes.lectures}
              className="text-[10px] uppercase tracking-widest text-[#555] hover:text-[#d4af37] transition-colors"
            >
              ← All Lectures
            </Link>
            <Link
              href={Routes.home}
              className="text-[10px] uppercase tracking-widest text-[#555] hover:text-[#d4af37] transition-colors"
            >
              Home →
            </Link>
          </div>
        </SectionReveal>
      </article>

      <Footer {...footer} />
    </main>
  );
}
