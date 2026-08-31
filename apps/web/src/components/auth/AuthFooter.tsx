import Link from "next/link";
import { Fragment } from "react";

interface FooterLink {
  label: string;
  href: string;
  gold?: boolean;
}

interface AuthFooterProps {
  links: FooterLink[];
}

export default function AuthFooter({ links }: AuthFooterProps) {
  return (
    <footer className="flex w-full items-center justify-between px-1 text-[15px] font-light text-white lg:justify-center lg:gap-8 lg:text-[16px]">
      {links.map((link, i) => (
        <Fragment key={link.label}>
          {i > 0 && <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-white" />}
          <Link href={link.href} className={link.gold ? "text-kink-gold-bright" : undefined}>
            {link.label}
          </Link>
        </Fragment>
      ))}
    </footer>
  );
}
