"use client";
import RingPurchaseView from "@/components/kink-rings/RingPurchaseView";
import { useRingPurchasePresenter } from "@/presenters/useRingPurchasePresenter";
export default function BuyRingsPage() {
  const vm = useRingPurchasePresenter();
  return <RingPurchaseView {...vm} />;
}
