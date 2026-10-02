import Link from "next/link";
import type { VerificationPrivacyVM } from "@/presenters/getVerificationPrivacyVM";

export default function VerificationPrivacyPage({
  homeHref,
  contactHref,
  effectiveDate,
  sections,
  diditNoticeHref,
}: VerificationPrivacyVM) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-kink-gold-bright selection:text-black">
      <header className="border-b border-kink-divider">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href={homeHref}
            className="text-xl font-black tracking-[0.16em] text-kink-gold-bright sm:text-2xl"
          >
            KINKORD
          </Link>
          <Link
            href={contactHref}
            className="text-sm font-semibold text-neutral-300 underline-offset-4 hover:text-kink-gold-bright hover:underline"
          >
            Contact us
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-kink-gold-bright">
            Trust &amp; safety / Kinkord KYC
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Your ID is not <span className="text-kink-gold-bright">your profile.</span>
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-300 sm:text-lg">
            A clear look at the information used for Kinkord KYC, who handles it, and what other
            members can see.
          </p>
          <p className="mt-4 text-sm font-semibold text-neutral-400">
            Effective date: {effectiveDate}
          </p>
        </div>

        <aside
          className="mt-10 max-w-3xl rounded-2xl border border-kink-gold-bright/40 bg-[#17130a] p-5 sm:p-6"
          aria-label="Important verification information"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-kink-gold-bright">
            Your choice
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-200">
            Kinkord KYC is optional and involves sensitive ID and biometric information. Read this
            notice before you consent. Refusing does not prevent you from using an ordinary Kinkord
            account.
          </p>
        </aside>

        <nav
          aria-label="On this page"
          className="mt-10 rounded-2xl border border-neutral-800 bg-[#101010] p-5 sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
            On this page
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="text-sm font-semibold text-neutral-200 underline-offset-4 hover:text-kink-gold-bright hover:underline"
              >
                {section.title}
              </a>
            ))}
            <a
              href="#provider-notices"
              className="text-sm font-semibold text-neutral-200 underline-offset-4 hover:text-kink-gold-bright hover:underline"
            >
              Provider notices
            </a>
          </div>
        </nav>

        <div className="mt-12 max-w-3xl divide-y divide-neutral-800">
          {sections.map((section) => (
            <section id={section.id} key={section.id} className="scroll-mt-8 py-8 first:pt-0">
              <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-neutral-300 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
          <section id="provider-notices" className="scroll-mt-8 py-8">
            <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">
              Provider notices
            </h2>
            <p className="mt-4 text-sm leading-7 text-neutral-300 sm:text-base">
              This describes how Didit handles information in its verification service. The hosted
              flow may show additional notices and consent choices.
            </p>
            <div className="mt-4 flex flex-col items-start gap-3 text-sm font-bold">
              <a
                href={diditNoticeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-kink-gold-bright underline underline-offset-4"
              >
                Didit verification privacy notice ↗
              </a>
            </div>
          </section>
        </div>

        <div className="mt-6 max-w-3xl rounded-2xl border border-neutral-800 bg-[#101010] p-6">
          <h2 className="text-lg font-bold text-white">Questions about your verification data?</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Get in touch through Kinkord support. Please do not attach identity documents to your
            message.
          </p>
          <Link
            href={contactHref}
            className="mt-5 inline-flex rounded-full bg-kink-gold-bright px-6 py-3 text-sm font-extrabold text-black transition-colors hover:bg-kink-gold-deep"
          >
            Contact Kinkord
          </Link>
        </div>
      </main>
      <footer className="border-t border-kink-divider px-5 py-6 text-center text-xs text-neutral-500">
        © Kinkord Limited · Kinkord KYC privacy notice
      </footer>
    </div>
  );
}
