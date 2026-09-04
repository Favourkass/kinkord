import {
  AGE_DISCLAIMER_FOOTER,
  COMPANY_ADDRESS,
  COMPANY_NAME,
  FOOTER_LINKS,
  SOCIALS,
} from "@/constants/landing";

export function getFooterVM() {
  return {
    links: FOOTER_LINKS.map((l) => ({ ...l })),
    socials: SOCIALS.map((s) => ({ name: s.name, href: s.href })),
    addressLine: `${COMPANY_NAME} · ${COMPANY_ADDRESS}`,
    ageDisclaimer: AGE_DISCLAIMER_FOOTER,
  };
}

export type FooterVM = ReturnType<typeof getFooterVM>;
