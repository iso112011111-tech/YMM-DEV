import { BOT_CATALOG, type BotConfig } from "@/data/siteData";

interface FeaturedBotProps {
  onOpenGuide: (bot: BotConfig) => void;
}

export default function FeaturedBot({ onOpenGuide }: FeaturedBotProps) {
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
            <a
              className="discord-button"
              href={bot.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>◉</span> เพิ่มบอทในเซิร์ฟเวอร์ <b>→</b>
            </a>
            <button
              className="outline-button"
              type="button"
              onClick={() => onOpenGuide(bot)}
            >
              ▣ &nbsp; ดูวิธีการใช้งาน
            </button>
            {bot.name === "BOT-ROLE" && (
              <button
                className="outline-button"
                type="button"
                disabled
                title="Dashboard กำลังเตรียมให้ใช้งาน"
              >
                ⚙ &nbsp; Edit Dashboard
              </button>
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
