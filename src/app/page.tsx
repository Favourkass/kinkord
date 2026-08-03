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

export default function Home() {
  return (
    <main>
      <Hero />
      <Stats />
      <WhyKinkord />
      <ConsentSafety />
      <About />
      <Education />
      <Community />
      <Invest />
      <TeamLogin />
      <Mission />
      <FinalCTA />
      <Footer />
    </main>
  );
}
