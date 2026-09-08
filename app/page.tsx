"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import FeaturedBot from "@/components/FeaturedBot";
import Footer from "@/components/Footer";
import GuideModal from "@/components/GuideModal";
import { FEATURED_BOT, type BotConfig } from "@/data/siteData";

export default function Home() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotConfig>(FEATURED_BOT);

  const openGuide = (bot: BotConfig) => {
    setSelectedBot(bot);
    setIsGuideOpen(true);
  };

  return (
    <main>
      <Navbar onOpenGuide={openGuide} />
      <Hero onOpenGuide={() => setIsGuideOpen(true)} />
      <Features />
      <FeaturedBot onOpenGuide={openGuide} />
      <Footer onOpenGuide={() => setIsGuideOpen(true)} />
      <GuideModal
        bot={selectedBot}
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </main>
  );
}
