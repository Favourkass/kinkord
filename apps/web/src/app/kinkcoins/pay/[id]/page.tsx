"use client";
import { useParams } from "next/navigation";
import WalletScreen from "../../WalletScreen";
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <WalletScreen mode="pay" paymentId={id} />;
}
