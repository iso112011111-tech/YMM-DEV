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

export default function TranscriptPage() {
  const params = useParams();
  const transcriptId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingDays, setRemainingDays] = useState(30);

  useEffect(() => {
    let isMounted = true;

    async function fetchTranscript() {
      if (!transcriptId) {
        if (isMounted) {
          setError("ไม่พบรหัส Transcript");
          setLoading(false);
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
          return;
        }

        const data = docSnap.data() as TranscriptData;
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // ตรวจสอบเงื่อนไขหมดอายุ (เกิน 30 วันนับจากวันที่สร้าง)
        const expired = (data.expiresAtMs && now > data.expiresAtMs) ||
          (data.createdAtMs && now - data.createdAtMs > thirtyDaysMs);

        if (expired) {
          // ลบออกจาก Firestore ทันทีเมื่อมีคนเปิดอ่านหลังจากหมดอายุ
          await deleteDoc(docRef).catch(() => {});
          if (isMounted) {
            setIsExpired(true);
            setLoading(false);
          }
          return;
        }

        const targetExpiry = data.expiresAtMs || (data.createdAtMs ? data.createdAtMs + thirtyDaysMs : now + thirtyDaysMs);
        const diff = targetExpiry - now;
        const days = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));

        if (isMounted) {
          setRemainingDays(days);
          setTranscript(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error("Fetch transcript error:", err);
        if (isMounted) {
          setError("เกิดข้อผิดพลาดในการโหลดประวัติการสนทนา");
          setLoading(false);
        }
      }
    }

    fetchTranscript();

    return () => {
      isMounted = false;
    };
  }, [transcriptId]);


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
    // แปลง URL ให้เป็น clickable link
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
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">กำลังโหลดประวัติการสนทนา Ticket...</p>
      </div>
    );
  }

  // State 2: Expired (เกิน 30 วัน)
  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161b22] border border-amber-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center text-3xl mb-4">
            ⏳
          </div>
          <h1 className="text-xl font-bold text-white mb-2">ประวัติการสนทนานี้หมดอายุแล้ว</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            ตามนโยบายความเป็นส่วนตัวและความปลอดภัย ข้อมูลบันทึกประวัติการคุย (Transcript)
            จะถูกจัดเก็บไว้เป็นเวลา <strong>30 วัน</strong> หลังจากปิดตั๋ว
            และถูกลบออกจากฐานข้อมูลเรียบร้อยแล้ว
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Not found or Error
  if (error || !transcript) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161b22] border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto bg-rose-500/10 rounded-full flex items-center justify-center text-3xl mb-4">
            🔍
          </div>
          <h1 className="text-xl font-bold text-white mb-2">ไม่พบประวัติการสนทนา</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            {error || "ไม่พบเอกสาร Transcript รหัสนี้ หรืออาจถูกลบออกไปแล้ว"}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  // State 4: Valid Transcript View
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 antialiased selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#161b22]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {transcript.guildIcon ? (
              <img
                src={transcript.guildIcon}
                alt={transcript.guildName}
                className="w-9 h-9 rounded-full object-cover border border-slate-700 flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-indigo-400 flex-shrink-0">
                {transcript.guildName?.charAt(0) || "D"}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-white text-sm sm:text-base truncate">
                {transcript.guildName}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Ticket #{transcript.ticketNumber} • {transcript.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Ticket Closed
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
              ⏳ จะถูกลบใน {remainingDays} วัน
            </span>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
        {/* Ticket Information Header Card */}
        <section className="bg-[#161b22] border border-slate-800 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  ID: #{transcript.ticketNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  หมวดหมู่: {transcript.category}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {transcript.subject || "บันทึกการสนทนา Ticket"}
              </h1>
            </div>

            <div className="text-xs text-slate-400 flex flex-col gap-1 md:text-right">
              <div>สร้างเมื่อ: <span className="text-slate-200">{formatDate(transcript.createdAtMs)}</span></div>
              <div>จำนวนข้อความ: <span className="text-indigo-400 font-semibold">{transcript.messageCount || transcript.messages?.length || 0} ข้อความ</span></div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="bg-[#0d1117]/60 border border-slate-800/60 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">👤 ผู้เปิดตั๋ว</span>
              <p className="text-xs font-semibold text-white truncate" title={transcript.authorTag}>
                {transcript.authorTag}
              </p>
            </div>

            <div className="bg-[#0d1117]/60 border border-slate-800/60 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">🔏 ผู้ปิดตั๋ว</span>
              <p className="text-xs font-semibold text-white truncate" title={transcript.closedById}>
                {transcript.closedById}
              </p>
            </div>

            <div className="bg-[#0d1117]/60 border border-slate-800/60 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">🛡️ ผู้รับเคส</span>
              <p className="text-xs font-semibold text-white truncate">
                {transcript.claimedByTag || "Not claimed"}
              </p>
            </div>

            <div className="bg-[#0d1117]/60 border border-slate-800/60 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">❓ เหตุผล</span>
              <p className="text-xs font-semibold text-white truncate" title={transcript.reason}>
                {transcript.reason || "No reason specified"}
              </p>
            </div>
          </div>
        </section>

        {/* Message Feed */}
        <section className="bg-[#161b22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3.5 border-b border-slate-800/80 bg-[#12161c] flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              💬 ประวัติการสนทนา ({transcript.messages?.length || 0})
            </span>
            <span className="text-[11px] text-slate-400">
              เรียงตามลำดับเวลา
            </span>
          </div>

          <div className="divide-y divide-slate-800/40 p-2 sm:p-4">
            {(!transcript.messages || transcript.messages.length === 0) ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                ไม่มีข้อความในประวัติการสนทนานี้
              </div>
            ) : (
              transcript.messages.map((msg, index) => {
                const isBot = !!msg.author.bot;
                return (
                  <div
                    key={msg.id || index}
                    className={`flex items-start gap-3 sm:gap-4 p-3 rounded-xl transition-colors hover:bg-slate-800/30 ${
                      isBot ? "bg-indigo-950/10" : ""
                    }`}
                  >
                    {/* Avatar */}
                    {msg.author.avatar ? (
                      <img
                        src={msg.author.avatar}
                        alt={msg.author.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-slate-300 flex-shrink-0 mt-0.5">
                        {msg.author.displayName?.charAt(0) || "?"}
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                        <span className={`text-sm font-semibold ${isBot ? "text-indigo-400" : "text-white"}`}>
                          {msg.author.displayName || msg.author.username}
                        </span>
                        {isBot && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                            BOT
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>

                      {/* Text content */}
                      {msg.content && (
                        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                          {renderContent(msg.content)}
                        </div>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-3">
                          {msg.attachments.map((att, aIdx) => {
                            const isImage = att.contentType?.startsWith("image/") ||
                              att.name?.match(/\.(png|jpe?g|gif|webp)$/i);

                            if (isImage) {
                              return (
                                <a
                                  key={att.id || aIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-lg overflow-hidden border border-slate-700 max-w-sm hover:opacity-95 transition-opacity"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="max-h-64 object-contain bg-black/40"
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
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-sky-400 hover:bg-slate-800 transition-colors"
                              >
                                📎 {att.name}
                                {att.size ? (
                                  <span className="text-slate-400">
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
                        <div className="mt-3 flex flex-col gap-2">
                          {msg.embeds.map((emb, eIdx) => (
                            <div
                              key={eIdx}
                              className="border-l-4 border-indigo-500 bg-[#0d1117] rounded-r-xl p-3.5 border-t border-r border-b border-slate-800 text-xs"
                            >
                              {emb.title && (
                                <h4 className="font-bold text-white text-sm mb-1.5">{emb.title}</h4>
                              )}
                              {emb.description && (
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap mb-2">
                                  {emb.description}
                                </p>
                              )}
                              {emb.fields && emb.fields.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60">
                                  {emb.fields.map((f, fIdx) => (
                                    <div key={fIdx}>
                                      <span className="font-semibold text-slate-400 block mb-0.5">{f.name}</span>
                                      <span className="text-slate-200">{f.value}</span>
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
        <footer className="mt-8 mb-12 text-center text-xs text-slate-400 leading-relaxed">
          <p>
            🔒 ข้อมูลบันทึกการสนทนานี้ถูกสร้างโดยระบบ <strong>YMM Ticket Bot</strong> สำหรับการตรวจสอบย้อนหลัง
          </p>
          <p className="mt-1">
            ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวรภายใน 30 วันนับจากวันที่สร้าง เพื่อความเป็นส่วนตัวและความปลอดภัยของผู้ใช้
          </p>
        </footer>
      </main>
    </div>
  );
}
