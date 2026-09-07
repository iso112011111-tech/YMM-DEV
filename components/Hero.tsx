import { SITE_CONFIG } from "@/data/siteData";

interface HeroProps {
  onOpenGuide: () => void;
}

export default function Hero({ onOpenGuide }: HeroProps) {
  return (
    <section className="market-hero" id="top" aria-label="Hero banner">
      <div className="hero-inner shell">
        <div className="hero-copy">
          <p className="hero-kicker">
            {SITE_CONFIG.name} <span>|</span> {SITE_CONFIG.tagline.toUpperCase()}
          </p>
          <h1>
            รวมบอท Discord คุณภาพ
            <br />
            จาก <strong>{SITE_CONFIG.name}</strong>
          </h1>
          <p className="hero-lead">
            บอท Discord ที่คัดสรรมาเพื่อชุมชนของคุณ
            <br />
            ใช้งานง่าย เสถียร และพร้อมดูแลตลอด 24 ชั่วโมง
          </p>
          <div className="hero-actions">
            <a className="discord-button" href="#bots">
              <span>◉</span> เริ่มใช้งาน Discord <b>→</b>
            </a>
            <button
              className="outline-button"
              type="button"
              onClick={onOpenGuide}
            >
              <span>◉</span> ดูวิธีการใช้งาน
            </button>
          </div>
        </div>

        <div className="bot-scene-wrapper">
          <div className="bot-scene" aria-label="ภาพจำลองหน้าต่างบอท YMM-MUSIC">
            <div className="scene-mark" aria-hidden="true">
              Y
            </div>

            <div className="music-panel main-panel">
              <div className="music-icon" aria-hidden="true">
                ♫
              </div>
              <div className="panel-info">
                <h2>
                  YMM-MUSIC <small>BOT</small>
                </h2>
                <p>ฟังเพลง • จัดการเพลง • ใช้งานง่าย</p>
              </div>
              <span className="online-dot" title="ระบบออนไลน์" />
              <div className="panel-link">
                ออนไลน์ <span aria-hidden="true">→</span>
              </div>
              <div className="panel-sub">
                ดูรายละเอียดเพิ่มเติม <span aria-hidden="true">→</span>
              </div>
            </div>

            <div className="music-panel queue-panel">
              <div className="queue-title">
                <span className="queue-note" aria-hidden="true">
                  ♫
                </span>
                <div>
                  <b>YMM-MUSIC</b> <small>BOT</small>
                  <p>กำลังเล่น</p>
                </div>
                <span aria-hidden="true">×</span>
              </div>

              <div className="queue-song">
                <span aria-hidden="true">♫</span>
                <div>
                  <b>Saran - แค่คุณคนเดียว</b>
                  <small>02:34 / 03:21</small>
                </div>
              </div>

              <div
                className="progress"
                role="progressbar"
                aria-valuenow={74}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="ความคืบหน้าของเพลง"
              >
                <span style={{ width: "74%" }} />
              </div>

              <div className="player-controls" aria-label="ปุ่มควบคุมเพลง">
                <b aria-hidden="true">‹</b>
                <strong aria-hidden="true">Ⅱ</strong>
                <b aria-hidden="true">›</b>
              </div>

              <p className="queue-heading">คิวเพลง (3)</p>
              <ol>
                <li>
                  แค่คุณคนเดียว - Saran <time>03:21</time>
                </li>
                <li>
                  ดอกไม้เบอร์ 2 <time>02:58</time>
                </li>
                <li>
                  รอไม่ไหวจริงๆ <time>04:12</time>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
