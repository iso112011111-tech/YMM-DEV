import Image from "next/image";
import logo from "@/app/img/logo.png";
import { SITE_CONFIG } from "@/data/siteData";

interface FooterProps {
  onOpenGuide: () => void;
}

export default function Footer({ onOpenGuide }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer shell" id="contact" aria-label="Footer">
      <div className="footer-brand">
        <Image
          src={logo}
          alt={`${SITE_CONFIG.name} logo`}
          width={42}
          height={42}
        />
        <span>
          <b>{SITE_CONFIG.name}</b>
          <small>{SITE_CONFIG.tagline}</small>
        </span>
      </div>

      <div className="footer-links">
        <a href="#top">หน้าแรก</a>
        <a href="#bots">บอททั้งหมด</a>
        <button
          className="nav-guide"
          type="button"
          onClick={onOpenGuide}
        >
          วิธีใช้งาน
        </button>
        <a
          href={SITE_CONFIG.links.discordSupport}
          target="_blank"
          rel="noopener noreferrer"
        >
          ติดต่อเรา
        </a>
      </div>

      <div className="footer-copy">
        © {currentYear} {SITE_CONFIG.name}. All rights reserved.
      </div>
    </footer>
  );
}
