import { FEATURED_BOT, SITE_CONFIG } from "@/data/siteData";

interface FeaturedBotProps {
  onOpenGuide: () => void;
}

export default function FeaturedBot({ onOpenGuide }: FeaturedBotProps) {
  return (
    <section className="featured-bot shell" id="bots" aria-label="บอทแนะนำ">
      <div className="bot-overview">
        <div className="bot-avatar" aria-hidden="true">
          ♫
        </div>
        <div>
          <h2>
            {FEATURED_BOT.name} <small>{FEATURED_BOT.type}</small>
          </h2>
          <h3>{FEATURED_BOT.headline}</h3>
          <p>{FEATURED_BOT.description}</p>
          <div className="tags" aria-label="แท็กหมวดหมู่">
            {FEATURED_BOT.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="bot-features">
        <h3>ฟีเจอร์เด่น</h3>
        {FEATURED_BOT.features.map((feat) => (
          <p key={feat}>✓ {feat}</p>
        ))}
      </div>

      <div className="bot-actions">
        <a
          className="discord-button"
          href={SITE_CONFIG.links.botInvite}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>◉</span> เพิ่มบอทในเซิร์ฟเวอร์ <b>→</b>
        </a>
        <button
          className="outline-button"
          type="button"
          onClick={onOpenGuide}
        >
          ▣ &nbsp; ดูวิธีการใช้งาน
        </button>
        <div className="bot-stats" aria-label="สถิติการใช้งานบอท">
          <span>
            ♟ <b>ผู้ใช้งานทั้งหมด</b>
            <strong>{FEATURED_BOT.stats.users}</strong>
          </span>
          <span>
            ☻ <b>เซิร์ฟเวอร์ที่ใช้งาน</b>
            <strong>{FEATURED_BOT.stats.servers}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
