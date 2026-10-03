import { notFound } from "next/navigation";
import { COMING_SOON_FEATURES, getComingSoonFeatureVM } from "@/presenters/getComingSoonFeatureVM";
import ComingSoonFeatureScreen from "./ComingSoonFeatureScreen";

// Only the features listed exist; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return COMING_SOON_FEATURES.map((feature) => ({ feature }));
}

export default async function FeatureComingSoonPage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const copy = getComingSoonFeatureVM((await params).feature);
  if (!copy) notFound();
  return <ComingSoonFeatureScreen copy={copy} />;
}
