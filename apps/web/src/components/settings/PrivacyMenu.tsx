import Link from "next/link";
import { ChevronRightIcon } from "@/components/app/icons";

export interface PrivacyMenuProps {
  title: string;
  backHref: string;
  categories: readonly { key: string; icon: string; label: string; href: string }[];
}

export default function PrivacyMenu(p: PrivacyMenuProps) {
  return (
    <section className="mx-auto w-full max-w-[640px] px-4 py-6">
      <Link href={p.backHref} className="text-sm text-kink-gold-bright">
        ← Settings
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-bold text-kink-gold-bright">{p.title}</h1>
      <nav
        aria-label={p.title}
        className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-kink-gold-bright/25 bg-black"
      >
        {p.categories.map((category) => (
          <Link
            key={category.key}
            href={category.href}
            className="flex min-h-20 items-center gap-4 px-4 py-5 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-kink-gold-bright"
          >
            <span aria-hidden="true" className="shrink-0 text-2xl text-kink-gold-bright">
              {category.icon}
            </span>
            <span className="flex-1 text-base font-semibold text-kink-gold-bright">
              {category.label}
            </span>
            <ChevronRightIcon className="shrink-0 text-kink-gold-bright" />
          </Link>
        ))}
      </nav>
    </section>
  );
}
