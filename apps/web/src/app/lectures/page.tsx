import Link from "next/link";
import Footer from "@/components/sections/Footer";
import SectionReveal from "@/components/ui/SectionReveal";
import { Routes } from "@/constants/Routes";
import { getFooterVM } from "@/presenters/getFooterVM";
import * as lectureService from "@/services/lecture.service";
import type { LectureVM } from "@/domain/lecture";

export const metadata = {
  title: "Lectures & Education — Kinkord",
  description:
    "Explore educational lectures on consent, safety, relationship dynamics and lifestyle education from the Kinkord community.",
};

export const revalidate = 60;

export default async function LecturesPage() {
  const footer = getFooterVM();
  let lectures: LectureVM[] = [];
  try {
    lectures = await lectureService.listPublishedLectures();
  } catch {
    // Sheets not configured yet — show empty state
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <section className="py-24 md:py-32 text-center px-6 border-b border-[#d4af37]/08 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.05)_0%,_transparent_65%)] pointer-events-none" />
        <SectionReveal>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#d4af37] mb-4">
            Knowledge · Safety · Expression
          </p>
          <h1
            className="text-4xl md:text-5xl font-bold text-[#f5f5f0] mb-4 leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Lectures & Education
          </h1>
          <div className="section-divider mb-6" />
          <p className="text-sm text-[#888] max-w-lg mx-auto">
            Explore our growing library of educational resources covering consent, safety,
            relationship dynamics and lifestyle exploration.
          </p>
        </SectionReveal>
      </section>

      <section className="py-16 md:py-24 px-6 max-w-5xl mx-auto">
        {lectures.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#444] text-sm">No lectures published yet. Check back soon.</p>
            <Link
              href={Routes.home}
              className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:underline mt-4 inline-block"
            >
              ← Back to home
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {lectures.map((lecture, i) => (
              <SectionReveal key={lecture.id} delay={i * 0.06}>
                <Link
                  href={Routes.lecture(lecture.slug)}
                  className="group block border border-[#d4af37]/12 bg-[#0d0d0d] hover:border-[#d4af37]/40 hover:bg-[#0f0f0f] transition-all duration-300 h-full"
                >
                  <div className="p-6 flex flex-col h-full">
                    <span className="text-[9px] uppercase tracking-widest text-[#d4af37]/60 mb-3 block">
                      {lecture.category}
                    </span>
                    <h2
                      className="text-base font-bold text-[#f5f5f0] leading-snug mb-3 group-hover:text-[#f5e27d] transition-colors"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      {lecture.title}
                    </h2>
                    <p className="text-xs text-[#777] leading-relaxed flex-1">
                      {lectureService.excerpt(lecture.body)}
                    </p>
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#d4af37]/08">
                      <span className="text-[9px] text-[#444] uppercase tracking-wider">
                        {lecture.createdAtLabel}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-[#d4af37] group-hover:tracking-[0.2em] transition-all duration-200">
                        Read →
                      </span>
                    </div>
                  </div>
                </Link>
              </SectionReveal>
            ))}
          </div>
        )}
      </section>

      <Footer {...footer} />
    </main>
  );
}
