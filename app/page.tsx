"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import FeaturedBot from "@/components/FeaturedBot";
import Footer from "@/components/Footer";
import GuideModal from "@/components/GuideModal";

export default function Home() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <main>
      <Navbar onOpenGuide={() => setIsGuideOpen(true)} />
      <Hero onOpenGuide={() => setIsGuideOpen(true)} />
      <Features />
      <FeaturedBot onOpenGuide={() => setIsGuideOpen(true)} />
      <Footer onOpenGuide={() => setIsGuideOpen(true)} />
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </main>
  );
}
