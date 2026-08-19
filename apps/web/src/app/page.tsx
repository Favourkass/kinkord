import Hero from "@/components/sections/Hero";
import Stats from "@/components/sections/Stats";
import WhyKinkord from "@/components/sections/WhyKinkord";
import ConsentSafety from "@/components/sections/ConsentSafety";
import About from "@/components/sections/About";
import Education from "@/components/sections/Education";
import Community from "@/components/sections/Community";
import Invest from "@/components/sections/Invest";
import TeamLogin from "@/components/sections/TeamLogin";
import Mission from "@/components/sections/Mission";
import FinalCTA from "@/components/sections/FinalCTA";
import Footer from "@/components/sections/Footer";
import { getLandingVM } from "@/presenters/getLandingVM";

export default function Home() {
  const vm = getLandingVM();

  return (
    <main>
      <Hero {...vm.hero} />
      <Stats {...vm.stats} />
      <WhyKinkord {...vm.why} />
      <ConsentSafety />
      <About />
      <Education {...vm.education} />
      <Community {...vm.community} />
      <Invest {...vm.investTeaser} />
      <TeamLogin />
      <Mission />
      <FinalCTA {...vm.finalCta} />
      <Footer {...vm.footer} />
    </main>
  );
}
