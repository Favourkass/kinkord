import {
  BUSINESS_MODEL,
  CURRENT_POSITION,
  INVESTMENT_STRUCTURE,
  INVESTMENT_TIERS,
  INVESTOR_BENEFITS,
  INVEST_WHATSAPP_MESSAGE,
  INVEST_WHATSAPP_URL,
  OWNERSHIP_EXIT,
  PROBLEMS,
  USE_OF_FUNDS,
  VISION_ITEMS,
} from "@/constants/invest";
import { FOOTER_LINKS, SOCIALS } from "@/constants/landing";
import { Routes } from "@/constants/Routes";

export function getInvestVM() {
  return {
    whatsappUrl: INVEST_WHATSAPP_URL,
    whatsappMessage: INVEST_WHATSAPP_MESSAGE,
    homeHref: Routes.home,
    currentPosition: [...CURRENT_POSITION],
    visionItems: [...VISION_ITEMS],
    problems: [...PROBLEMS],
    investmentStructure: [...INVESTMENT_STRUCTURE],
    investmentTiers: INVESTMENT_TIERS.map((t) => ({ ...t })),
    investorBenefits: [...INVESTOR_BENEFITS],
    businessModel: [...BUSINESS_MODEL],
    useOfFunds: USE_OF_FUNDS.map((u) => ({ ...u })),
    ownershipExit: [...OWNERSHIP_EXIT],
    footer: {
      links: FOOTER_LINKS.map((l) => ({ ...l })),
      socials: SOCIALS.map((s) => ({ name: s.name, href: s.href })),
    },
  };
}

export type InvestVM = ReturnType<typeof getInvestVM>;
