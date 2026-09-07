"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "@/app/img/logo.png";
import { SITE_CONFIG } from "@/data/siteData";

interface NavbarProps {
  onOpenGuide: () => void;
}

interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

export default function Navbar({ onOpenGuide }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<DiscordProfile | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { profile: DiscordProfile | null }) => setProfile(data.profile))
      .catch(() => setProfile(null));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null);
  };

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header" ref={headerRef}>
      <nav className="nav-inner shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="YMM-DEV หน้าแรก">
          <Image
            className="brand-logo"
            src={logo}
            alt="YMM-DEV logo"
            width={44}
            height={44}
            priority
          />
          <span>{SITE_CONFIG.name}</span>
        </a>

        <div className={`nav-links${isMenuOpen ? " is-open" : ""}`}>
          <a
            className="nav-active"
            href="#top"
            aria-current="page"
            onClick={closeMenu}
          >
            <span className="home-icon">⌂</span> หน้าแรก
          </a>
          <a href="#bots" onClick={closeMenu}>
            บอททั้งหมด
          </a>
          <Link
            href="/dashboard"
            onClick={closeMenu}
            style={{
              color: "#c4b5fd",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>⚙</span> Dashboard
          </Link>
          <button
            className="nav-guide"
            type="button"
            onClick={() => {
              onOpenGuide();
              closeMenu();
            }}
          >
            วิธีใช้งาน
          </button>
          <a
            href={SITE_CONFIG.links.discordSupport}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
          >
            ติดต่อเรา
          </a>
        </div>

        <label className="nav-search" htmlFor="bot-search">
          <span aria-hidden="true">⌕</span>
          <input
            id="bot-search"
            name="bot-search"
            type="search"
            placeholder="ค้นหาบอท..."
            aria-label="ค้นหาบอทในระบบ"
            autoComplete="off"
          />
        </label>

        {profile ? (
          <div className="nav-profile">
            <Image
              src={
                profile.avatar
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
                  : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 5}.png`
              }
              alt=""
              width={32}
              height={32}
              unoptimized
            />
            <span>{profile.globalName || profile.username}</span>
            <button type="button" onClick={logout} aria-label="ออกจากระบบ Discord">
              ออก
            </button>
          </div>
        ) : (
          <a className="discord-login" href="/api/auth/discord">
            เข้าสู่ระบบด้วย Discord
          </a>
        )}

        <button
          className={`menu-toggle${isMenuOpen ? " is-open" : ""}`}
          type="button"
          aria-label={isMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
    </header>
  );
}
