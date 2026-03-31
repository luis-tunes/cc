import { Nav } from "./landing/Nav";
import { Hero } from "./landing/Hero";
import { Sectors, Features } from "./landing/Features";
import { HowItWorks } from "./landing/HowItWorks";
import { Stats } from "./landing/Stats";
import { Pricing } from "./landing/Pricing";
import { Testimonials } from "./landing/Testimonials";
import { FAQ } from "./landing/FAQ";
import { CTA } from "./landing/CTA";
import { Footer } from "./landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background antialiased scroll-smooth">
      <Nav />
      <Hero />
      <Sectors />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

