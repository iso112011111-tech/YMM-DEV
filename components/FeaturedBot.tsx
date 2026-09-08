"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BOT_CATALOG, type BotConfig } from "@/data/siteData";

interface FeaturedBotProps {
  onOpenGuide: (bot: BotConfig) => void;
}

export default function FeaturedBot({ onOpenGuide }: FeaturedBotProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { profile: unknown }) => setIsLoggedIn(Boolean(data.profile)))
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <section className="bot-list shell" id="bots" aria-label="บอทแนะนำ">
      {BOT_CATALOG.map((bot, index) => (
        <article className="featured-bot" key={bot.name}>
          <div className="bot-overview">
            <div className={`bot-avatar bot-avatar-${index}`} aria-hidden="true">
              {index === 0 ? "♫" : "✦"}
            </div>
            <div>
              <h2>
                {bot.name} <small>{bot.type}</small>
              </h2>
              <h3>{bot.headline}</h3>
              <p>{bot.description}</p>
              <div className="tags" aria-label="แท็กหมวดหมู่">
                {bot.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bot-features">
            <h3>ฟีเจอร์เด่น</h3>
            {bot.features.map((feat) => (
              <p key={feat}>✓ {feat}</p>
            ))}
          </div>

          <div className="bot-actions">
            {isLoggedIn ? (
              <a
                className="discord-button"
                href={bot.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>◉</span> เพิ่มบอทในเซิร์ฟเวอร์ <b>→</b>
              </a>
            ) : (
              <button className="discord-button" type="button" disabled>
                <span>◉</span> เพิ่มบอทในเซิร์ฟเวอร์ <b>→</b>
              </button>
            )}
            <button
              className="outline-button"
              type="button"
              onClick={() => onOpenGuide(bot)}
            >
              ▣ &nbsp; ดูวิธีการใช้งาน
            </button>
            {(bot.name === "BOT-ROLE" || bot.name === "BOT-TICKET") && (
              isLoggedIn ? (
                <Link
                  className="outline-button"
                  href="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))",
                    borderColor: "rgba(139, 92, 246, 0.5)",
                    color: "#c4b5fd"
                  }}
                >
                  ⚙ &nbsp; Edit Dashboard
                </Link>
              ) : (
                <button
                  className="outline-button"
                  type="button"
                  disabled
                  title="กรุณาเข้าสู่ระบบด้วย Discord ก่อน"
                >
                  ⚙ &nbsp; Edit Dashboard
                </button>
              )
            )}
            <div className="bot-stats" aria-label="สถิติการใช้งานบอท">
              <span>
                ♟ <b>ผู้ใช้งานทั้งหมด</b>
                <strong>{bot.stats.users}</strong>
              </span>
              <span>
                ☻ <b>เซิร์ฟเวอร์ที่ใช้งาน</b>
                <strong>{bot.stats.servers}</strong>
              </span>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
