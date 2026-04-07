import { Nav } from "./landing/Nav";
import { Hero } from "./landing/Hero";
import { ProductTheater } from "./landing/ProductTheater";
import { Features } from "./landing/Features";
import { HowItWorks } from "./landing/HowItWorks";
import { Testimonials } from "./landing/Testimonials";
import { Pricing } from "./landing/Pricing";
import { Footer } from "./landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background antialiased scroll-smooth overscroll-none">
      <Nav />
      <Hero />
      <ProductTheater />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Footer />
    </div>
  );
}

