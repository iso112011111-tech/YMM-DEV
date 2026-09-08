"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/app/img/logo.png";
import { ticketDb } from "@/lib/firebaseTicket";
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy,
  limit
} from "firebase/firestore";

interface TicketEmbedConfig {
  panel_title: string;
  panel_description: string;
  panel_color: string;
  welcome_message: string;
  footer_text: string;
}

interface TicketSystemConfig {
  category_id: string;
  log_channel_id: string;
  staff_role_ids: string[];
  supervisor_role_id: string | null;
  sla_minutes: number;
  auto_close_hours: number;
}

interface TicketAiConfig {
  provider: "gemini" | "openai" | "claude";
  model: string;
  api_key?: string;
  encrypted_api_key?: string | null;
  is_active: boolean;
}

interface TicketStats {
  total_tickets: number;
  open_tickets: number;
  avg_csat: number;
}

interface FullTicketGuildConfig {
  guild_id: string;
  guild_name: string;
  embed_customization: TicketEmbedConfig;
  ticket_config: TicketSystemConfig;
  ai_config: TicketAiConfig;
  stats: TicketStats;
}

interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  image_url?: string;
  tags: string[];
  created_at?: any;
}

interface TicketItem {
  id: string;
  ticket_number: number;
  subject: string;
  author_tag: string;
  status: string;
  priority: string;
  csat_score?: number | null;
  created_at?: any;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  guilds?: DiscordGuild[];
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: string;
}

const DEFAULT_CONFIG: FullTicketGuildConfig = {
  guild_id: "",
  guild_name: "YMM DEV",
  embed_customization: {
    panel_title: "🎫 ระบบ Support Ticket",
    panel_description: "ยินดีต้อนรับสู่ศูนย์บริการความช่วยเหลือ\nกรุณากดปุ่มด้านล่างเพื่อสร้าง Ticket และรับการดูแลจากทีมงาน ✨",
    panel_color: "#5865F2",
    welcome_message: "สวัสดีครับ ทีมงานจะเข้ามาช่วยเหลือในไม่ช้า",
    footer_text: "Powered by YMM-TICKET",
  },
  ticket_config: {
    category_id: "",
    log_channel_id: "",
    staff_role_ids: [],
    supervisor_role_id: null,
    sla_minutes: 30,
    auto_close_hours: 48,
  },
  ai_config: {
    provider: "gemini",
    model: "gemini-3.6-flash",
    api_key: "",
    is_active: true,
  },
  stats: {
    total_tickets: 0,
    open_tickets: 0,
    avg_csat: 5.0,
  }
};

const PRESET_COLORS = [
  { name: "Discord Blurple", hex: "#5865F2" },
  { name: "Neon Blue", hex: "#3B82F6" },
  { name: "Emerald Green", hex: "#10B981" },
  { name: "Cyber Cyan", hex: "#06B6D4" },
  { name: "Amber Gold", hex: "#F59E0B" },
  { name: "Coral Red", hex: "#EF4444" },
  { name: "Neon Purple", hex: "#8B5CF6" },
];

export default function DashboardTicketPage() {
  const [config, setConfig] = useState<FullTicketGuildConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"appearance" | "system" | "ai" | "kb" | "tickets">("appearance");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [showApiKey, setShowApiKey] = useState(false);

  // Knowledge Base State
  const [kbArticles, setKbArticles] = useState<KnowledgeArticle[]>([]);
  const [newKbTitle, setNewKbTitle] = useState("");
  const [newKbCategory, setNewKbCategory] = useState("general");
  const [newKbContent, setNewKbContent] = useState("");
  const [newKbImageUrl, setNewKbImageUrl] = useState("");
  const [newKbTags, setNewKbTags] = useState("");
  const [addingKb, setAddingKb] = useState(false);

  // Tickets List State
  const [recentTickets, setRecentTickets] = useState<TicketItem[]>([]);

  // Discord Profile & Live Bot Data
  const [profile, setProfile] = useState<DiscordProfile | null>(null);
  const [botGuilds, setBotGuilds] = useState<DiscordGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [categories, setCategories] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  const isLoggedIn = Boolean(profile);
  const hasBotInCurrentServer = (botGuilds || []).some((g) => g.id === config.guild_id);

  // 1. Fetch User Profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { profile: DiscordProfile | null }) => {
        setProfile(data.profile);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoadingAuth(false));
  }, []);

  // 2. Fetch Guilds for Ticket Bot
  useEffect(() => {
    fetch("/api/discord/guilds?bot=ticket")
      .then((res) => res.json())
      .then((data: { guilds?: DiscordGuild[] }) => {
        if (data.guilds && data.guilds.length > 0) {
          setBotGuilds(data.guilds);
          setConfig((prev) => {
            if (!prev.guild_id) {
              const firstGuild = data.guilds![0];
              return {
                ...prev,
                guild_id: firstGuild.id,
                guild_name: firstGuild.name,
              };
            }
            return prev;
          });
        }
      })
      .catch((err) => console.warn("Could not load ticket bot guilds:", err))
      .finally(() => setLoadingGuilds(false));
  }, []);

  // 3. Fetch Channels & Roles for active guild
  useEffect(() => {
    if (!config.guild_id) return;

    fetch(`/api/discord/guilds?bot=ticket&guildId=${config.guild_id}`)
      .then((res) => res.json())
      .then((data: { channels?: DiscordChannel[]; categories?: DiscordChannel[]; roles?: DiscordRole[] }) => {
        if (data.channels) setChannels(data.channels);
        if (data.categories) setCategories(data.categories);
        if (data.roles) setRoles(data.roles);
      })
      .catch((err) => console.warn("Could not load channels/roles:", err));
  }, [config.guild_id]);

  // 4. Real-time Firestore Sync for Guild Config
  useEffect(() => {
    if (!config.guild_id) return;
    const docRef = doc(ticketDb, "guilds", config.guild_id);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setConfig((prev) => ({
          ...prev,
          guild_id: config.guild_id,
          guild_name: data.guild_name || prev.guild_name,
          embed_customization: {
            ...prev.embed_customization,
            ...(data.embed_customization || {}),
          },
          ticket_config: {
            ...prev.ticket_config,
            ...(data.ticket_config || {}),
          },
          ai_config: {
            ...prev.ai_config,
            ...(data.ai_config || {}),
            api_key: prev.ai_config.api_key, // keep current input in form
          },
          stats: {
            ...prev.stats,
            ...(data.stats || {}),
          }
        }));
      }
    });

    return () => unsubscribe();
  }, [config.guild_id]);

  // 5. Real-time Knowledge Base Sync
  useEffect(() => {
    if (!config.guild_id) return;
    const kbCol = collection(ticketDb, "guilds", config.guild_id, "knowledge_base");
    const q = query(kbCol, orderBy("created_at", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: KnowledgeArticle[] = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || "ไม่มีหัวข้อ",
        category: doc.data().category || "general",
        content: doc.data().content || "",
        image_url: doc.data().image_url || "",
        tags: doc.data().tags || [],
        created_at: doc.data().created_at,
      }));
      setKbArticles(items);
    }, (err) => {
      console.warn("Knowledge base listener note:", err.message);
    });

    return () => unsubscribe();
  }, [config.guild_id]);

  // 6. Real-time Recent Tickets Sync
  useEffect(() => {
    if (!config.guild_id) return;
    const ticketsCol = collection(ticketDb, "guilds", config.guild_id, "tickets");
    const q = query(ticketsCol, orderBy("created_at", "desc"), limit(20));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: TicketItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ticket_number: doc.data().ticket_number || 0,
        subject: doc.data().subject || "ไม่มีหัวข้อ",
        author_tag: doc.data().author_tag || "User",
        status: doc.data().status || "open",
        priority: doc.data().priority || "normal",
        csat_score: doc.data().csat_score ?? null,
        created_at: doc.data().created_at,
      }));
      setRecentTickets(items);
    }, (err) => {
      console.warn("Tickets listener note:", err.message);
    });

    return () => unsubscribe();
  }, [config.guild_id]);

  // Save Config to Firestore
  const handleSave = async () => {
    if (!profile) {
      alert("กรุณาเข้าสู่ระบบ Discord ก่อนบันทึกการตั้งค่า");
      return;
    }
    if (!hasBotInCurrentServer) {
      alert("ไม่สามารถบันทึกได้ เนื่องจากเซิร์ฟเวอร์นี้ยังไม่ได้ติดตั้งบอท YMM-TICKET");
      return;
    }

    setSaving(true);
    setSaveStatus("idle");

    try {
      const activeServerName = botGuilds.find((g) => g.id === config.guild_id)?.name || config.guild_name || "Server";
      const docRef = doc(ticketDb, "guilds", config.guild_id);

      const updates: any = {
        guild_id: config.guild_id,
        guild_name: activeServerName,
        embed_customization: config.embed_customization,
        ticket_config: config.ticket_config,
        'ai_config.provider': config.ai_config.provider,
        'ai_config.model': config.ai_config.model,
        'ai_config.is_active': config.ai_config.is_active,
        updated_at: serverTimestamp(),
      };

      // If user typed a new API Key in web form
      if (config.ai_config.api_key && config.ai_config.api_key.trim()) {
        updates['ai_config.raw_api_key_web'] = config.ai_config.api_key.trim();
      }

      await setDoc(docRef, updates, { merge: true });

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (error) {
      console.error("Save config error:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Add Knowledge Base Article
  const handleAddKb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbTitle.trim() || !newKbContent.trim()) {
      alert("กรุณากรอกหัวข้อและเนื้อหาของบทความ");
      return;
    }

    setAddingKb(true);
    try {
      const tagsArray = newKbTags
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      const kbCol = collection(ticketDb, "guilds", config.guild_id, "knowledge_base");
      await addDoc(kbCol, {
        title: newKbTitle.trim(),
        category: newKbCategory.trim(),
        content: newKbContent.trim(),
        image_url: newKbImageUrl.trim() || null,
        tags: tagsArray,
        created_by: profile?.username || "Web Admin",
        created_at: serverTimestamp(),
      });

      setNewKbTitle("");
      setNewKbContent("");
      setNewKbImageUrl("");
      setNewKbTags("");
      alert("✅ เพิ่มบทความลงคลังความรู้สำเร็จ!");
    } catch (err: any) {
      console.error("Add KB error:", err);
      alert("❌ เพิ่มบทความล้มเหลว: " + err.message);
    } finally {
      setAddingKb(false);
    }
  };

  // Delete Knowledge Base Article
  const handleDeleteKb = async (articleId: string, title: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบทความ "${title}"?`)) return;

    try {
      const docRef = doc(ticketDb, "guilds", config.guild_id, "knowledge_base", articleId);
      await deleteDoc(docRef);
    } catch (err: any) {
      console.error("Delete KB error:", err);
      alert("ลบล้มเหลว: " + err.message);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c1322",
      color: "#f1f5f9",
      fontFamily: "Inter, sans-serif",
      paddingBottom: "80px"
    }}>
      {/* Top Header Navbar */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(12, 19, 34, 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(88, 101, 242, 0.2)",
        padding: "12px 24px"
      }}>
        <div style={{
          maxWidth: "1400px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          {/* Logo & Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
              <Image src={logo} alt="Logo" width={34} height={34} style={{ borderRadius: "8px" }} />
              <span style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.5px", color: "#fff" }}>
                YMM<span style={{ color: "#5865F2" }}>.TICKET</span>
              </span>
            </Link>
            <span style={{
              background: "rgba(88, 101, 242, 0.15)",
              color: "#818cf8",
              border: "1px solid rgba(88, 101, 242, 0.3)",
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "20px",
              textTransform: "uppercase"
            }}>
              Ticket Dashboard
            </span>
          </div>

          {/* Server Switcher Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>เซิร์ฟเวอร์:</span>
            <select
              value={config.guild_id}
              onChange={(e) => {
                const selected = botGuilds.find((g) => g.id === e.target.value);
                if (selected) {
                  setConfig((prev) => ({
                    ...prev,
                    guild_id: selected.id,
                    guild_name: selected.name,
                  }));
                }
              }}
              style={{
                background: "#1e293b",
                color: "#fff",
                border: "1px solid rgba(88, 101, 242, 0.4)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "0.9rem",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
                maxWidth: "240px"
              }}
            >
              {botGuilds.length === 0 ? (
                <option value="">{loadingGuilds ? "กำลังค้นหาเซิร์ฟเวอร์..." : "ไม่พบบอทในเซิร์ฟเวอร์ใด"}</option>
              ) : (
                botGuilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))
              )}
            </select>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving || !hasBotInCurrentServer}
              style={{
                background: saving 
                  ? "#475569" 
                  : saveStatus === "success" 
                    ? "#10B981" 
                    : "linear-gradient(135deg, #5865F2, #4752C4)",
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: (saving || !hasBotInCurrentServer) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(88, 101, 242, 0.3)",
                transition: "all 0.2s ease"
              }}
            >
              {saving ? "⏳ กำลังบันทึก..." : saveStatus === "success" ? "✓ บันทึกสำเร็จ!" : "💾 บันทึกการตั้งค่า"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1400px", margin: "32px auto", padding: "0 24px" }}>
        
        {/* Status Notice Banner if Bot not in server */}
        {!loadingGuilds && !hasBotInCurrentServer && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <b style={{ color: "#ef4444" }}>⚠️ บอท YMM-TICKET ยังไม่ได้อยู่ในเซิร์ฟเวอร์นี้</b>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "4px 0 0" }}>
                กรุณาเชิญบอทเข้าเซิร์ฟเวอร์ก่อน จึงจะสามารถเปิดใช้งานและบันทึกการตั้งค่าได้
              </p>
            </div>
            <a
              href="https://discord.com/oauth2/authorize?client_id=1546731977271677001&permissions=8&integration_type=0&scope=bot+applications.commands"
              target="_blank"
              rel="noreferrer"
              style={{
                background: "#5865F2",
                color: "#fff",
                textDecoration: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.85rem"
              }}
            >
              ➕ เชิญบอทเข้าเซิร์ฟเวอร์
            </a>
          </div>
        )}

        {/* Quota & Stats Overview Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px"
        }}>
          {/* Active Quota Card (Max 50) */}
          <div style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "18px 20px"
          }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              Ticket ที่เปิดอยู่ (Quota)
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
              <span style={{ fontSize: "1.8rem", fontWeight: 800, color: config.stats.open_tickets >= 45 ? "#ef4444" : "#5865F2" }}>
                {config.stats.open_tickets}
              </span>
              <span style={{ fontSize: "1rem", color: "#64748b" }}>/ 50 เคสสูงสุด</span>
            </div>
            <div style={{
              width: "100%",
              height: "6px",
              background: "#334155",
              borderRadius: "3px",
              marginTop: "10px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${Math.min(100, (config.stats.open_tickets / 50) * 100)}%`,
                height: "100%",
                background: config.stats.open_tickets >= 45 ? "#ef4444" : "#5865F2",
                transition: "width 0.3s ease"
              }} />
            </div>
          </div>

          {/* Total Tickets */}
          <div style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "18px 20px"
          }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              Ticket ทั้งหมดที่เคยเปิด
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#fff", marginTop: "8px" }}>
              {config.stats.total_tickets} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>เคส</span>
            </div>
          </div>

          {/* Average CSAT */}
          <div style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "18px 20px"
          }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              คะแนนความพึงพอใจ (CSAT)
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f59e0b", marginTop: "8px" }}>
              ⭐ {config.stats.avg_csat ? config.stats.avg_csat.toFixed(1) : "5.0"} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>/ 5.0</span>
            </div>
          </div>

          {/* Knowledge Base Count */}
          <div style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "18px 20px"
          }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
              คลังความรู้ AI (FAQ)
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981", marginTop: "8px" }}>
              📚 {kbArticles.length} <span style={{ fontSize: "0.9rem", color: "#64748b" }}>บทความ</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Layout (Left: Settings, Right: Live Discord Preview) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: "28px", alignItems: "start" }}>
          
          {/* Left Column: Tabs & Settings Form */}
          <div style={{ background: "#131d31", borderRadius: "16px", border: "1px solid rgba(255, 255, 255, 0.08)", overflow: "hidden" }}>
            
            {/* Tabs Header */}
            <div style={{
              display: "flex",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "#0f172a",
              overflowX: "auto"
            }}>
              {[
                { id: "appearance", label: "🎨 ธีม & Embed" },
                { id: "system", label: "⚙️ ระบบ Ticket" },
                { id: "ai", label: "🤖 AI (BYOK)" },
                { id: "kb", label: `📚 คลังความรู้ (${kbArticles.length})` },
                { id: "tickets", label: `📊 รายการเคส (${recentTickets.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: "14px 20px",
                    background: activeTab === tab.id ? "#131d31" : "transparent",
                    color: activeTab === tab.id ? "#fff" : "#94a3b8",
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    fontSize: "0.9rem",
                    border: "none",
                    borderBottom: activeTab === tab.id ? "2px solid #5865F2" : "2px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ padding: "28px" }}>
              
              {/* TAB 1: APPEARANCE & EMBED */}
              {activeTab === "appearance" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>🎨 ปรับแต่งธีมสี & Embed Panel</h3>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                      กำหนดสีและข้อความที่จะแสดงบน Embed ของ Ticket Panel ใน Discord
                    </p>
                  </div>

                  {/* Color Picker */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>
                      สีหลักของ Embed (Panel Color):
                    </label>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setConfig((prev) => ({
                            ...prev,
                            embed_customization: { ...prev.embed_customization, panel_color: c.hex }
                          }))}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: c.hex,
                            border: config.embed_customization.panel_color.toLowerCase() === c.hex.toLowerCase() 
                              ? "3px solid #ffffff" 
                              : "1px solid rgba(0,0,0,0.3)",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                          }}
                          title={c.name}
                        />
                      ))}
                      <input
                        type="color"
                        value={config.embed_customization.panel_color}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          embed_customization: { ...prev.embed_customization, panel_color: e.target.value }
                        }))}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          border: "none",
                          cursor: "pointer",
                          background: "transparent"
                        }}
                      />
                      <span style={{ fontSize: "0.9rem", color: "#94a3b8", fontFamily: "monospace" }}>
                        {config.embed_customization.panel_color}
                      </span>
                    </div>
                  </div>

                  {/* Panel Title */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      หัวข้อ Embed (Panel Title):
                    </label>
                    <input
                      type="text"
                      value={config.embed_customization.panel_title}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        embed_customization: { ...prev.embed_customization, panel_title: e.target.value }
                      }))}
                      placeholder="🎫 ระบบ Support Ticket"
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    />
                  </div>

                  {/* Panel Description */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      คำอธิบาย Embed (Panel Description):
                    </label>
                    <textarea
                      rows={3}
                      value={config.embed_customization.panel_description}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        embed_customization: { ...prev.embed_customization, panel_description: e.target.value }
                      }))}
                      placeholder="กดปุ่มด้านล่างเพื่อสร้าง Ticket ใหม่..."
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem",
                        resize: "vertical"
                      }}
                    />
                  </div>

                  {/* Welcome Message */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      ข้อความต้อนรับในห้อง Ticket (Welcome Message):
                    </label>
                    <input
                      type="text"
                      value={config.embed_customization.welcome_message}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        embed_customization: { ...prev.embed_customization, welcome_message: e.target.value }
                      }))}
                      placeholder="สวัสดีครับ ทีมงานจะเข้ามาช่วยเหลือในไม่ช้า"
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    />
                  </div>

                  {/* Footer Text */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      ข้อความส่วนท้าย (Footer Text):
                    </label>
                    <input
                      type="text"
                      value={config.embed_customization.footer_text}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        embed_customization: { ...prev.embed_customization, footer_text: e.target.value }
                      }))}
                      placeholder="Powered by YMM-TICKET"
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: SYSTEM SETTINGS */}
              {activeTab === "system" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>⚙️ ตั้งค่าห้องและบทบาททีมงาน</h3>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                      กำหนดหมวดหมู่ห้อง, Log Channel, และ Role ผู้รับผิดชอบ Ticket
                    </p>
                  </div>

                  {/* Category Selection */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      📁 หมวดหมู่สร้างห้อง (Category):
                    </label>
                    <select
                      value={config.ticket_config.category_id || ""}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ticket_config: { ...prev.ticket_config, category_id: e.target.value }
                      }))}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    >
                      <option value="">-- เลือก Category สำหรับสร้างห้อง Ticket --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          📂 {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Log Channel Selection */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      📝 ห้องบันทึกประวัติ (Log Channel):
                    </label>
                    <select
                      value={config.ticket_config.log_channel_id || ""}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ticket_config: { ...prev.ticket_config, log_channel_id: e.target.value }
                      }))}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    >
                      <option value="">-- เลือก Channel สำหรับส่ง Transcript --</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          # {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Staff Role */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      👥 ยศทีมงาน (Staff Role):
                    </label>
                    <select
                      value={config.ticket_config.staff_role_ids[0] || ""}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ticket_config: { ...prev.ticket_config, staff_role_ids: [e.target.value] }
                      }))}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    >
                      <option value="">-- เลือก Role ทีมงานที่ดูแลเคส --</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          🛡️ {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Supervisor Role */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      👑 ยศหัวหน้างาน (Supervisor Role สำหรับแจ้งเตือน SLA):
                    </label>
                    <select
                      value={config.ticket_config.supervisor_role_id || ""}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ticket_config: { ...prev.ticket_config, supervisor_role_id: e.target.value || null }
                      }))}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    >
                      <option value="">-- ไม่ระบุ (ไม่แจ้งเตือนหัวหน้า) --</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          👑 {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SLA Settings */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                        ⏱️ SLA ตอบกลับครั้งแรก (นาที):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={config.ticket_config.sla_minutes}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          ticket_config: { ...prev.ticket_config, sla_minutes: parseInt(e.target.value) || 30 }
                        }))}
                        style={{
                          width: "100%",
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          color: "#fff",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                        🔒 ปิดอัตโนมัติหากไม่มีการตอบ (ชั่วโมง):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={168}
                        value={config.ticket_config.auto_close_hours}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          ticket_config: { ...prev.ticket_config, auto_close_hours: parseInt(e.target.value) || 48 }
                        }))}
                        style={{
                          width: "100%",
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          color: "#fff",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                  </div>

                  {/* Quota Rule Alert */}
                  <div style={{
                    background: "rgba(88, 101, 242, 0.08)",
                    border: "1px solid rgba(88, 101, 242, 0.2)",
                    borderRadius: "8px",
                    padding: "14px",
                    fontSize: "0.85rem",
                    color: "#94a3b8",
                    lineHeight: 1.5
                  }}>
                    🛡️ <b>กฎความปลอดภัยประจำเซิร์ฟเวอร์:</b><br />
                    • จำกัดเปิด Ticket ได้สูงสุด <b>50 เคส</b> พร้อมกัน (หากถึง 50 เคส บอทจะล็อกไม่ให้สร้างเคสใหม่จนกว่าจะปิดเคสเดิม)<br />
                    • <b>ผู้ใช้ทั่วไปไม่สามารถกดปิดเคสเองได้</b> ต้องเป็นทีมงานหรือ Admin เท่านั้น
                  </div>
                </div>
              )}

              {/* TAB 3: AI BYOK CONFIG */}
              {activeTab === "ai" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>🤖 เชื่อมต่อ AI Assistant (BYOK)</h3>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                      นำ API Key ของคุณมาเชื่อมต่อ เพื่อให้ AI ช่วยตอบคำถามและวิเคราะห์ปัญหาในห้อง Ticket อัตโนมัติ
                    </p>
                  </div>

                  {/* Enable AI Toggle */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    background: "#0f172a",
                    borderRadius: "10px",
                    border: "1px solid #334155"
                  }}>
                    <div>
                      <b style={{ color: "#fff", fontSize: "0.95rem" }}>เปิดใช้งานระบบ AI ช่วยตอบ</b>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                        AI จะคอยตอบคำถามและอ่านรูปภาพในห้อง Ticket จนกว่าทีมงานจะกดรับเคส
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.ai_config.is_active}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ai_config: { ...prev.ai_config, is_active: e.target.checked }
                      }))}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                  </div>

                  {/* AI Provider */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      ผู้ให้บริการ AI (Provider):
                    </label>
                    <select
                      value={config.ai_config.provider}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ai_config: { 
                          ...prev.ai_config, 
                          provider: e.target.value as any,
                          model: e.target.value === "gemini" ? "gemini-3.6-flash" : e.target.value === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022"
                        }
                      }))}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    >
                      <option value="gemini">Google Gemini (แนะนำ: รองรับโมเดลรุ่น 3.6 เร็วมาก)</option>
                      <option value="openai">OpenAI (ChatGPT / GPT-4o)</option>
                      <option value="claude">Anthropic Claude</option>
                    </select>
                  </div>

                  {/* Model Name */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                      ชื่อโมเดล (Model Name):
                    </label>
                    <input
                      type="text"
                      value={config.ai_config.model}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ai_config: { ...prev.ai_config, model: e.target.value }
                      }))}
                      placeholder="เช่น gemini-3.6-flash หรือ gpt-4o-mini"
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                      {["gemini-3.6-flash", "gemini-3.8-flash", "gpt-4o-mini"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setConfig((prev) => ({
                            ...prev,
                            ai_config: { ...prev.ai_config, model: m }
                          }))}
                          style={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            color: "#94a3b8",
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                        >
                          + {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key Input */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1" }}>
                        API Key ของคุณ:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{ background: "none", border: "none", color: "#818cf8", fontSize: "0.8rem", cursor: "pointer" }}
                      >
                        {showApiKey ? "ซ่อน Key" : "แสดง Key"}
                      </button>
                    </div>
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={config.ai_config.api_key || ""}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ai_config: { ...prev.ai_config, api_key: e.target.value }
                      }))}
                      placeholder="วาง API Key (เช่น sk-... หรือ AQ.Ab...)"
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "#fff",
                        fontSize: "0.9rem"
                      }}
                    />
                    <small style={{ color: "#64748b", fontSize: "0.75rem", display: "block", marginTop: "4px" }}>
                      🔐 ระบบเข้ารหัส API Key ด้วย AES-256-GCM ผูกกับ Server ID เพื่อความปลอดภัยสูงสุด
                    </small>
                  </div>
                </div>
              )}

              {/* TAB 4: KNOWLEDGE BASE MANAGEMENT */}
              {activeTab === "kb" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>📚 จัดการคลังความรู้ (Knowledge Base)</h3>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                      เพิ่มบทความ คู่มือ และรูปภาพวิธีทำ เพื่อให้ AI ดึงข้อมูลไปตอบผู้ใช้โดยอัตโนมัติ
                    </p>
                  </div>

                  {/* Add New Article Form */}
                  <form
                    onSubmit={handleAddKb}
                    style={{
                      background: "#0f172a",
                      border: "1px solid rgba(88, 101, 242, 0.3)",
                      borderRadius: "12px",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px"
                    }}
                  >
                    <b style={{ fontSize: "0.95rem", color: "#818cf8" }}>➕ เพิ่มบทความ / FAQ ใหม่</b>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                          หัวข้อปัญหา / คำถาม:
                        </label>
                        <input
                          type="text"
                          required
                          value={newKbTitle}
                          onChange={(e) => setNewKbTitle(e.target.value)}
                          placeholder="เช่น วิธีขอเงินคืน, ขั้นตอนเติมเงิน"
                          style={{
                            width: "100%",
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            color: "#fff",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                          หมวดหมู่:
                        </label>
                        <input
                          type="text"
                          value={newKbCategory}
                          onChange={(e) => setNewKbCategory(e.target.value)}
                          placeholder="billing / tech / ทั่วไป"
                          style={{
                            width: "100%",
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            color: "#fff",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                        รายละเอียดวิธีแก้ปัญหา (เพื่อให้ AI นำไปตอบ):
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={newKbContent}
                        onChange={(e) => setNewKbContent(e.target.value)}
                        placeholder="ระบุขั้นตอนการแก้ปัญหา หรือเงื่อนไขที่ผู้ใช้ต้องทราบ..."
                        style={{
                          width: "100%",
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "#fff",
                          fontSize: "0.85rem",
                          resize: "vertical"
                        }}
                      />
                    </div>

                    {/* Image URL Support */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                        🖼️ ลิงก์รูปภาพประกอบวิธีทำ (Image URL):
                      </label>
                      <input
                        type="url"
                        value={newKbImageUrl}
                        onChange={(e) => setNewKbImageUrl(e.target.value)}
                        placeholder="https://example.com/guide-image.png (หากมี)"
                        style={{
                          width: "100%",
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "#fff",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "4px" }}>
                        Tags ค้นหา (คั่นด้วยเครื่องหมายจุลภาค ,):
                      </label>
                      <input
                        type="text"
                        value={newKbTags}
                        onChange={(e) => setNewKbTags(e.target.value)}
                        placeholder="เช่น refund, เงินคืน, สลิป"
                        style={{
                          width: "100%",
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "#fff",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={addingKb}
                      style={{
                        alignSelf: "flex-end",
                        background: "#10b981",
                        color: "#fff",
                        border: "none",
                        padding: "8px 18px",
                        borderRadius: "6px",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        cursor: addingKb ? "not-allowed" : "pointer"
                      }}
                    >
                      {addingKb ? "⏳ กำลังบันทึก..." : "➕ บันทึกบทความ"}
                    </button>
                  </form>

                  {/* List of existing KB articles */}
                  <div>
                    <h4 style={{ fontSize: "0.95rem", color: "#cbd5e1", margin: "0 0 12px" }}>
                      รายการบทความที่มีในระบบ ({kbArticles.length})
                    </h4>
                    {kbArticles.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px", background: "#0f172a", borderRadius: "10px", color: "#64748b" }}>
                        ยังไม่มีบทความในคลังความรู้ เพิ่มบทความแรกของคุณด้านบนได้เลย!
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {kbArticles.map((art) => (
                          <div
                            key={art.id}
                            style={{
                              background: "#0f172a",
                              border: "1px solid #334155",
                              borderRadius: "10px",
                              padding: "14px 18px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "16px"
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <span style={{
                                  background: "#334155",
                                  color: "#94a3b8",
                                  fontSize: "0.7rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: 600
                                }}>
                                  {art.category}
                                </span>
                                <b style={{ fontSize: "0.95rem", color: "#fff" }}>{art.title}</b>
                              </div>
                              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "6px 0" }}>
                                {art.content}
                              </p>
                              {art.image_url && (
                                <div style={{ marginTop: "6px" }}>
                                  <a href={art.image_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#38bdf8", textDecoration: "none" }}>
                                    🖼️ ดูรูปภาพประกอบ ↗
                                  </a>
                                </div>
                              )}
                              <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                                {art.tags.map(t => (
                                  <span key={t} style={{ fontSize: "0.7rem", color: "#64748b", background: "#1e293b", padding: "1px 6px", borderRadius: "3px" }}>
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteKb(art.id, art.title)}
                              style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#f87171",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                                fontWeight: 600
                              }}
                            >
                              🗑️ ลบ
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: RECENT TICKETS */}
              {activeTab === "tickets" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>📊 รายการ Ticket ล่าสุดในเซิร์ฟเวอร์</h3>
                    <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                      ดูประวัติและสถานะของ Ticket ทั้งหมดที่เปิดในเซิร์ฟเวอร์นี้
                    </p>
                  </div>

                  {recentTickets.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", background: "#0f172a", borderRadius: "10px", color: "#64748b" }}>
                      ยังไม่มี Ticket ในเซิร์ฟเวอร์นี้
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                            <th style={{ padding: "10px 12px" }}>#</th>
                            <th style={{ padding: "10px 12px" }}>หัวข้อ</th>
                            <th style={{ padding: "10px 12px" }}>ผู้สร้าง</th>
                            <th style={{ padding: "10px 12px" }}>สถานะ</th>
                            <th style={{ padding: "10px 12px" }}>CSAT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentTickets.map((t) => (
                            <tr key={t.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: "#5865F2" }}>
                                #{t.ticket_number}
                              </td>
                              <td style={{ padding: "10px 12px", color: "#fff" }}>
                                {t.subject}
                              </td>
                              <td style={{ padding: "10px 12px", color: "#94a3b8" }}>
                                {t.author_tag}
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: t.status === "closed" ? "rgba(100, 116, 139, 0.2)" : "rgba(16, 185, 129, 0.15)",
                                  color: t.status === "closed" ? "#94a3b8" : "#34d399"
                                }}>
                                  {t.status === "closed" ? "ปิดแล้ว" : "เปิดอยู่"}
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px", color: "#f59e0b" }}>
                                {t.csat_score ? "⭐".repeat(t.csat_score) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Live Discord Embed Preview */}
          <div style={{ position: "sticky", top: "90px" }}>
            <div style={{
              background: "#1e1f22",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "20px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.4)"
            }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>👁️ ตัวอย่างหน้าจอใน Discord (Live Preview)</span>
              </div>

              {/* Simulated Discord Message */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#5865F2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.9rem"
                }}>
                  BOT
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>YMM-TICKET</span>
                    <span style={{ background: "#5865F2", color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: "3px", fontWeight: 700 }}>
                      BOT
                    </span>
                    <span style={{ color: "#72767d", fontSize: "0.7rem" }}>วันนี้ เวลา 12:00</span>
                  </div>

                  {/* The Live Embed */}
                  <div style={{
                    marginTop: "8px",
                    background: "#2b2d31",
                    borderLeft: `4px solid ${config.embed_customization.panel_color || "#5865F2"}`,
                    borderRadius: "4px",
                    padding: "14px 16px",
                    maxWidth: "360px"
                  }}>
                    <b style={{ color: "#fff", fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>
                      {config.embed_customization.panel_title || "🎫 ระบบ Support Ticket"}
                    </b>
                    <p style={{ color: "#dbdee1", fontSize: "0.85rem", margin: "0 0 12px", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                      {config.embed_customization.panel_description || "กดปุ่มด้านล่างเพื่อสร้าง Ticket ใหม่"}
                    </p>

                    {/* Simulating categories fields */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px", marginBottom: "12px" }}>
                      <div style={{ background: "#1e1f22", padding: "6px 8px", borderRadius: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>
                        💻 Technical Support — ปัญหาทางเทคนิค
                      </div>
                      <div style={{ background: "#1e1f22", padding: "6px 8px", borderRadius: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>
                        💳 Billing & Payment — ปัญหาการชำระเงิน
                      </div>
                    </div>

                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      {config.embed_customization.footer_text || "Powered by YMM-TICKET"}
                    </div>
                  </div>

                  {/* Interactive Button Preview */}
                  <div style={{ marginTop: "10px" }}>
                    <button
                      type="button"
                      style={{
                        background: "#5865F2",
                        color: "#fff",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "default"
                      }}
                    >
                      <span>📩</span> สร้าง Ticket ใหม่
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
