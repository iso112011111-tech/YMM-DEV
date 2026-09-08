/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { ticketDb } from "@/lib/firebaseTicket";


interface MessageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bot?: boolean;
}

interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  proxyURL?: string;
  contentType?: string;
  size?: number;
}

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface MessageEmbed {
  title?: string;
  description?: string;
  color?: number | null;
  fields?: EmbedField[];
}

interface TranscriptMessage {
  id: string;
  author: MessageAuthor;
  content: string;
  attachments?: MessageAttachment[];
  embeds?: MessageEmbed[];
  createdAt: number;
}

interface TranscriptData {
  id: string;
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  ticketId: string;
  ticketNumber: number | string;
  subject: string;
  category: string;
  authorId: string;
  authorTag: string;
  closedById: string;
  closedByTag?: string;
  claimedById: string | null;
  claimedByTag: string | null;
  reason: string;
  createdAtMs: number;
  expiresAtMs: number;
  messages: TranscriptMessage[];
  messageCount: number;
}

interface DiscordUserProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

export default function TranscriptPage() {
  const params = useParams();
  const transcriptId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingDays, setRemainingDays] = useState(30);

  // Authentication & Authorization states
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [authRole, setAuthRole] = useState<"author" | "admin" | null>(null);
  const [userProfile, setUserProfile] = useState<DiscordUserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchTranscript() {
      if (!transcriptId) {
        if (isMounted) {
          setError("ไม่พบรหัส Transcript");
          setLoading(false);
          setAuthChecked(true);
        }
        return;
      }

      try {
        const docRef = doc(ticketDb, "transcripts", transcriptId);
        const docSnap = await getDoc(docRef);

        if (!isMounted) return;

        if (!docSnap.exists()) {
          setTranscript(null);
          setLoading(false);
          setAuthChecked(true);
          return;
        }

        const data = docSnap.data() as TranscriptData;
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // ตรวจสอบเงื่อนไขหมดอายุ (เกิน 30 วันนับจากวันที่สร้าง)
        const expired = (data.expiresAtMs && now > data.expiresAtMs) ||
          (data.createdAtMs && now - data.createdAtMs > thirtyDaysMs);

        if (expired) {
          await deleteDoc(docRef).catch(() => {});
          if (isMounted) {
            setIsExpired(true);
            setLoading(false);
            setAuthChecked(true);
          }
          return;
        }

        const targetExpiry = data.expiresAtMs || (data.createdAtMs ? data.createdAtMs + thirtyDaysMs : now + thirtyDaysMs);
        const diff = targetExpiry - now;
        const days = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));

        if (isMounted) {
          setRemainingDays(days);
          setTranscript(data);
        }

        // ตรวจสอบสิทธิ์ Discord Login & ผู้เปิดตั๋ว / แอดมินเซิร์ฟเวอร์
        try {
          const authRes = await fetch(`/api/transcript/${transcriptId}/auth`);
          if (authRes.ok) {
            const authData = await authRes.json();
            if (isMounted) {
              setAuthenticated(!!authData.authenticated);
              setAuthorized(!!authData.authorized);
              setAuthRole(authData.role || null);
              setUserProfile(authData.profile || null);
            }
          } else {
            if (isMounted) {
              setAuthenticated(false);
              setAuthorized(false);
            }
          }
        } catch {
          if (isMounted) {
            setAuthenticated(false);
            setAuthorized(false);
          }
        } finally {
          if (isMounted) {
            setAuthChecked(true);
            setLoading(false);
          }
        }
      } catch (err: unknown) {
        console.error("Fetch transcript error:", err);
        if (isMounted) {
          setError("เกิดข้อผิดพลาดในการโหลดประวัติการสนทนา");
          setLoading(false);
          setAuthChecked(true);
        }
      }
    }

    fetchTranscript();

    return () => {
      isMounted = false;
    };
  }, [transcriptId]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  };

  const formatDate = (ms?: number) => {
    if (!ms) return "-";
    const d = new Date(ms);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderContent = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // State 1: Loading
  if (loading || !authChecked) {
    return (
      <div className="tc-state-wrap">
        <div className="tc-state-box">
          <div className="tc-spinner" />
          <p className="tc-guild-sub">กำลังตรวจสอบสิทธิ์การเข้าถึง Ticket Log...</p>
        </div>
      </div>
    );
  }

  // State 2: Expired (เกิน 30 วัน)
  if (isExpired) {
    return (
      <div className="tc-state-wrap">
        <div className="tc-state-box">
          <div className="tc-state-icon amber">⏳</div>
          <h1 className="tc-ticket-title">ประวัติการสนทนานี้หมดอายุแล้ว</h1>
          <p className="tc-msg-text" style={{ marginTop: "14px", color: "#8b949e", textAlign: "center" }}>
            ตามนโยบายความเป็นส่วนตัวและความปลอดภัย ข้อมูลบันทึกประวัติการคุย (Transcript)
            จะถูกจัดเก็บไว้เป็นเวลา <strong>30 วัน</strong> หลังจากปิดตั๋ว
            และถูกลบออกจากฐานข้อมูลเรียบร้อยแล้ว
          </p>
          <Link href="/" className="tc-btn-home">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Not found or Error
  if (error || !transcript) {
    return (
      <div className="tc-state-wrap">
        <div className="tc-state-box">
          <div className="tc-state-icon rose">🔍</div>
          <h1 className="tc-ticket-title">ไม่พบประวัติการสนทนา</h1>
          <p className="tc-msg-text" style={{ marginTop: "14px", color: "#8b949e", textAlign: "center" }}>
            {error || "ไม่พบเอกสาร Transcript รหัสนี้ หรืออาจถูกลบออกไปแล้ว"}
          </p>
          <Link href="/" className="tc-btn-home">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  // State 4: Unauthenticated (ยังไม่ได้ Login Discord)
  if (!authenticated) {
    return (
      <div className="tc-state-wrap">
        <div className="tc-state-box">
          <div className="tc-state-icon" style={{ background: "rgba(88, 101, 242, 0.12)", color: "#5865f2" }}>
            🔒
          </div>
          <h1 className="tc-ticket-title">จำเป็นต้องเข้าสู่ระบบ Discord</h1>
          <p className="tc-msg-text" style={{ marginTop: "14px", color: "#8b949e", textAlign: "center" }}>
            หน้าบันทึกประวัติการสนทนานี้ถูกจำกัดสิทธิ์ความปลอดภัย กรุณาเข้าสู่ระบบด้วยบัญชี Discord เพื่อยืนยันตัวตนก่อนเข้าดู
          </p>

          <div
            style={{
              marginTop: "16px",
              padding: "12px 14px",
              background: "rgba(88, 101, 242, 0.08)",
              border: "1px solid rgba(88, 101, 242, 0.2)",
              borderRadius: "10px",
              fontSize: "0.78rem",
              color: "#c9d1d9",
              textAlign: "left",
              lineHeight: 1.6,
            }}
          >
            ℹ️ <strong>เงื่อนไขการอนุญาตเข้าดู:</strong>
            <br />
            • 👤 <strong>ผู้เปิดตั๋ว (Ticket Creator)</strong> ของเคสนี้
            <br />
            • 🛡️ <strong>ผู้ดูแลระบบ (Admin)</strong> ของเซิร์ฟเวอร์นี้เท่านั้น
          </div>

          <a
            href={`/api/auth/discord?redirect=/transcript/${transcriptId}`}
            className="tc-btn-discord"
          >
            เข้าสู่ระบบด้วย Discord
          </a>
        </div>
      </div>
    );
  }

  // State 5: Forbidden (Login แล้ว แต่ไม่ใช่คนเปิด และไม่ใช่แอดมิน)
  if (!authorized) {
    return (
      <div className="tc-state-wrap">
        <div className="tc-state-box">
          <div className="tc-state-icon rose">🚫</div>
          <h1 className="tc-ticket-title">ไม่มีสิทธิ์เข้าถึงประวัติการสนทนานี้</h1>
          <p className="tc-msg-text" style={{ marginTop: "14px", color: "#8b949e", textAlign: "center" }}>
            คุณไม่มีสิทธิ์เข้าดูบันทึกประวัตินี้ เนื่องจากระบบอนุญาตเฉพาะ <strong>ผู้เปิดตั๋ว</strong> หรือ{" "}
            <strong>ผู้ดูแลเซิร์ฟเวอร์ (Admin)</strong> ของเซิร์ฟเวอร์นี้เท่านั้น
          </p>

          {userProfile && (
            <div
              style={{
                marginTop: "16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                background: "#21262d",
                borderRadius: "20px",
                fontSize: "0.8rem",
                color: "#c9d1d9",
              }}
            >
              <span>เข้าสู่ระบบเป็น:</span>
              <strong style={{ color: "#ffffff" }}>
                {userProfile.globalName || userProfile.username}
              </strong>
            </div>
          )}

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href={`/api/auth/discord?redirect=/transcript/${transcriptId}`}
              className="tc-btn-home"
              style={{ background: "#5865f2", borderColor: "#5865f2" }}
            >
              สลับบัญชี Discord
            </a>
            <Link href="/" className="tc-btn-home">
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // State 6: Authorized (เป็นผู้เปิดตั๋ว หรือแอดมินเซิร์ฟเวอร์)
  return (
    <div className="tc-root">
      {/* Top Navbar */}
      <header className="tc-navbar">
        <div className="tc-navbar-inner">
          <div className="tc-guild-badge">
            {transcript.guildIcon ? (
              <img
                src={transcript.guildIcon}
                alt={transcript.guildName}
                className="tc-guild-icon"
              />
            ) : (
              <div className="tc-guild-icon-placeholder">
                {transcript.guildName?.charAt(0) || "D"}
              </div>
            )}
            <div className="tc-guild-info">
              <h2 className="tc-guild-name">{transcript.guildName}</h2>
              <p className="tc-guild-sub">
                Ticket #{transcript.ticketNumber} • {transcript.category}
              </p>
            </div>
          </div>

          <div className="tc-status-tags">
            {authRole === "author" ? (
              <span className="tc-badge-author">👤 คุณเป็นผู้เปิดตั๋ว</span>
            ) : authRole === "admin" ? (
              <span className="tc-badge-admin">🛡️ คุณเป็นแอดมินเซิร์ฟเวอร์</span>
            ) : null}

            <span className="tc-badge-closed">Ticket Closed</span>
            <span className="tc-badge-expiry">⏳ จะถูกลบใน {remainingDays} วัน</span>

            {userProfile && (
              <div className="tc-user-chip">
                {userProfile.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${userProfile.id}/${userProfile.avatar}.png?size=32`}
                    alt=""
                    className="tc-user-chip-avatar"
                  />
                ) : null}
                <span>{userProfile.globalName || userProfile.username}</span>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8b949e",
                    cursor: "pointer",
                    padding: "0 0 0 4px",
                    fontSize: "0.74rem",
                  }}
                  title="ออกจากระบบ"
                >
                  ออก
                </button>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* Main Content Area */}
      <main className="tc-main">
        {/* Ticket Information Header Card */}
        <section className="tc-card">
          <div className="tc-header-top">
            <div>
              <div className="tc-ticket-chips">
                <span className="tc-chip-id">ID: #{transcript.ticketNumber}</span>
                <span className="tc-chip-category">หมวดหมู่: {transcript.category}</span>
              </div>
              <h1 className="tc-ticket-title">
                {transcript.subject || "บันทึกการสนทนา Ticket"}
              </h1>
            </div>

            <div className="tc-header-meta">
              <div>
                สร้างเมื่อ: <span style={{ color: "#e6edf3" }}>{formatDate(transcript.createdAtMs)}</span>
              </div>
              <div>
                จำนวนข้อความ:{" "}
                <span style={{ color: "#7983f5", fontWeight: 700 }}>
                  {transcript.messageCount || transcript.messages?.length || 0} ข้อความ
                </span>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="tc-meta-grid">
            <div className="tc-meta-cell">
              <span className="tc-meta-cell-label">👤 ผู้เปิดตั๋ว</span>
              <p className="tc-meta-cell-val" title={transcript.authorTag}>
                {transcript.authorTag}
              </p>
            </div>

            <div className="tc-meta-cell">
              <span className="tc-meta-cell-label">🔏 ผู้ปิดตั๋ว</span>
              <p className="tc-meta-cell-val" title={transcript.closedById}>
                {transcript.closedById}
              </p>
            </div>

            <div className="tc-meta-cell">
              <span className="tc-meta-cell-label">🛡️ ผู้รับเคส</span>
              <p className="tc-meta-cell-val">
                {transcript.claimedByTag || "Not claimed"}
              </p>
            </div>

            <div className="tc-meta-cell">
              <span className="tc-meta-cell-label">❓ เหตุผล</span>
              <p className="tc-meta-cell-val" title={transcript.reason}>
                {transcript.reason || "No reason specified"}
              </p>
            </div>
          </div>
        </section>

        {/* Message Feed */}
        <section className="tc-chat-section">
          <div className="tc-chat-header">
            <span className="tc-chat-header-title">
              💬 ประวัติการสนทนา ({transcript.messages?.length || 0})
            </span>
            <span className="tc-chat-header-sub">เรียงตามลำดับเวลา</span>
          </div>

          <div className="tc-chat-feed">
            {!transcript.messages || transcript.messages.length === 0 ? (
              <div className="tc-empty">ไม่มีข้อความในประวัติการสนทนานี้</div>
            ) : (
              transcript.messages.map((msg, index) => {
                const isBot = !!msg.author.bot;
                return (
                  <div
                    key={msg.id || index}
                    className={`tc-msg ${isBot ? "is-bot" : ""}`}
                  >
                    {/* Avatar */}
                    {msg.author.avatar ? (
                      <img
                        src={msg.author.avatar}
                        alt={msg.author.displayName}
                        className="tc-msg-avatar"
                      />
                    ) : (
                      <div className="tc-msg-avatar-placeholder">
                        {msg.author.displayName?.charAt(0) || "?"}
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="tc-msg-body">
                      <div className="tc-msg-top">
                        <span className={`tc-msg-user ${isBot ? "bot" : ""}`}>
                          {msg.author.displayName || msg.author.username}
                        </span>
                        {isBot && <span className="tc-bot-tag">BOT</span>}
                        <span className="tc-msg-time">{formatDate(msg.createdAt)}</span>
                      </div>

                      {/* Text content */}
                      {msg.content && (
                        <div className="tc-msg-text">{renderContent(msg.content)}</div>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="tc-attachments">
                          {msg.attachments.map((att, aIdx) => {
                            const isImage =
                              att.contentType?.startsWith("image/") ||
                              att.name?.match(/\.(png|jpe?g|gif|webp)$/i);

                            if (isImage) {
                              return (
                                <a
                                  key={att.id || aIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="tc-img-preview"
                                    loading="lazy"
                                  />
                                </a>
                              );
                            }

                            return (
                              <a
                                key={att.id || aIdx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tc-file-card"
                              >
                                📎 {att.name}
                                {att.size ? (
                                  <span style={{ color: "#8b949e", fontSize: "0.75rem" }}>
                                    ({(att.size / 1024).toFixed(1)} KB)
                                  </span>
                                ) : null}
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* Embeds */}
                      {msg.embeds && msg.embeds.length > 0 && (
                        <div>
                          {msg.embeds.map((emb, eIdx) => (
                            <div key={eIdx} className="tc-embed-box">
                              {emb.title && <div className="tc-embed-title">{emb.title}</div>}
                              {emb.description && (
                                <div className="tc-embed-desc">{emb.description}</div>
                              )}
                              {emb.fields && emb.fields.length > 0 && (
                                <div className="tc-embed-fields">
                                  {emb.fields.map((f, fIdx) => (
                                    <div key={fIdx}>
                                      <span className="tc-meta-cell-label">{f.name}</span>
                                      <span style={{ fontSize: "0.82rem", color: "#e6edf3" }}>
                                        {f.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Footer Policy Notice */}
        <footer className="tc-footer">
          <p>
            🔒 ข้อมูลบันทึกการสนทนานี้ถูกสร้างโดยระบบ <strong>YMM Ticket Bot</strong> สำหรับการตรวจสอบย้อนหลัง
          </p>
          <p style={{ marginTop: "4px" }}>
            ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวรภายใน 30 วันนับจากวันที่สร้าง เพื่อความเป็นส่วนตัวและความปลอดภัยของผู้ใช้
          </p>
        </footer>
      </main>
    </div>
  );
}

