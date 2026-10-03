import Link from "next/link";
import type { VerificationPrivacyVM } from "@/presenters/getVerificationPrivacyVM";

const navLink =
  "text-sm font-semibold text-kink-cream underline-offset-4 hover:text-kink-gold-bright hover:underline";

/** The public identity verification privacy notice; every word comes from the VM. */
export default function VerificationPrivacyPage(vm: VerificationPrivacyVM) {
  return (
    <div className="min-h-screen bg-kink-ink text-kink-cream selection:bg-kink-gold-bright selection:text-kink-ink">
      <header className="border-b border-kink-divider">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href={vm.homeHref}
            className="text-xl font-black tracking-[0.16em] text-kink-gold-bright sm:text-2xl"
          >
            {vm.brand}
          </Link>
          <Link href={vm.contactHref} className={navLink}>
            {vm.contactLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-kink-gold-bright">
            {vm.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            {vm.headline.lead} <span className="text-kink-gold-bright">{vm.headline.accent}</span>
          </h1>
          <p className="mt-5 text-base leading-7 text-kink-mist sm:text-lg">{vm.lead}</p>
          <p className="mt-4 text-sm font-semibold text-kink-dim">{vm.effectiveDate}</p>
        </div>

        <aside
          className="mt-10 max-w-3xl rounded-2xl border border-kink-gold-bright/40 bg-kink-panel p-5 sm:p-6"
          aria-label={vm.choice.title}
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-kink-gold-bright">
            {vm.choice.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-kink-cream">{vm.choice.body}</p>
        </aside>

        <nav
          aria-label={vm.onThisPage}
          className="mt-10 rounded-2xl border border-kink-line bg-kink-surface p-5 sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-kink-dim">
            {vm.onThisPage}
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {[...vm.sections, vm.provider].map((section) => (
              <a key={section.id} href={`#${section.id}`} className={navLink}>
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-12 max-w-3xl divide-y divide-kink-line">
          {vm.sections.map((section) => (
            <section id={section.id} key={section.id} className="scroll-mt-8 py-8 first:pt-0">
              <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-kink-mist sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
          <section id={vm.provider.id} className="scroll-mt-8 py-8">
            <h2 className="text-xl font-bold text-kink-gold-bright sm:text-2xl">
              {vm.provider.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-kink-mist sm:text-base">{vm.provider.body}</p>
            <a
              href={vm.provider.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-bold text-kink-gold-bright underline underline-offset-4"
            >
              {vm.provider.linkLabel}
            </a>
          </section>
        </div>

        <div className="mt-6 max-w-3xl rounded-2xl border border-kink-line bg-kink-surface p-6">
          <h2 className="text-lg font-bold text-kink-cream">{vm.help.title}</h2>
          <p className="mt-2 text-sm leading-6 text-kink-mist">{vm.help.body}</p>
          <Link
            href={vm.contactHref}
            className="mt-5 inline-flex rounded-full bg-kink-gold-bright px-6 py-3 text-sm font-extrabold text-kink-ink transition-colors hover:bg-kink-gold-deep"
          >
            {vm.help.cta}
          </Link>
        </div>
      </main>
      <footer className="border-t border-kink-divider px-5 py-6 text-center text-xs text-kink-faint">
        {vm.footer}
      </footer>
    </div>
  );
}
