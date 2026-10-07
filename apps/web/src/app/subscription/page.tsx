"use client";

import SubscriptionChrome from "@/components/subscription/SubscriptionChrome";
import UpgradeView from "@/components/subscription/UpgradeView";
import { SUBSCRIPTION_COPY } from "@/constants/subscription";
import { useSubscriptionPresenter } from "@/presenters/useSubscriptionPresenter";

/** Silver Premium: the plans (Figma 2:179 phone, 2:2 desktop). */
export default function SubscriptionPage() {
  const p = useSubscriptionPresenter();
  const copy = SUBSCRIPTION_COPY.upgrade;
  return (
    <SubscriptionChrome
      tone="black"
      glow={{ phone: false, desktop: false }}
      back={{ label: SUBSCRIPTION_COPY.back, icon: "arrow", onClick: p.back }}
      width="plans"
    >
      <UpgradeView
        copy={{
          title: copy.title,
          subtitle: copy.subtitle,
          silverLabel: copy.silverLabel,
          crestAlt: copy.crestAlt,
          medalAlt: copy.medalAlt,
          headline: copy.headline,
          tagline: copy.tagline,
          features: copy.features,
          gold: copy.gold,
          diamond: copy.diamond,
          comingSoon: copy.comingSoon,
          slogan: copy.slogan,
        }}
        seeAll={p.showSeeAll ? copy.seeAll(copy.allBenefits.length) : null}
        planCard={p.planCard}
        options={p.options}
        onSelect={p.selectPeriod}
        cta={p.cta}
        error={p.error}
      />
    </SubscriptionChrome>
  );
}
