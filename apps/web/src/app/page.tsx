import SplashScreen from "@/components/landing/SplashScreen";
import { getLandingVM } from "@/presenters/getLandingVM";

export default function Home() {
  const vm = getLandingVM();

  return <SplashScreen {...vm} />;
}
