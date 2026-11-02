"use client";
import RingPurchaseView from "@/components/kink-rings/RingPurchaseView";
import { useRingPurchasePresenter } from "@/presenters/useRingPurchasePresenter";
export default function RingPurchasesPage() {
  const vm = useRingPurchasePresenter(true);
  return <RingPurchaseView {...vm} />;
}
