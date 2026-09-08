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

export interface TicketCategoryField {
  name: string;
  value: string;
}

interface TicketEmbedConfig {
  panel_title: string;
  panel_description: string;
  panel_color: string;
  welcome_message: string;
  footer_text: string;
  button_text?: string;
  button_style?: "primary" | "success" | "secondary" | "danger";
  button_emoji?: string;
  button_color?: string;
  categories?: TicketCategoryField[];
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
  channel_id?: string | null;
  channel_ids?: string[];
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

function colorToDiscordStyle(hexColor?: string): "primary" | "success" | "secondary" | "danger" {
  if (!hexColor || typeof hexColor !== "string") return "primary";
  const cleanHex = hexColor.replace("#", "").trim();
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return "primary";

  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return "primary";

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 28 || (max < 80 && delta < 35)) return "secondary";
  if (g > r + 15 && g > b + 15) return "success";
  if (r > 150 && (r > g + 30) && (g < 170 || r > b + 20)) return "danger";
  return "primary";
}

function getDiscordButtonColor(style?: string): string {
  if (style === "success") return "#248046";
  if (style === "danger") return "#da373c";
  if (style === "secondary") return "#4e5058";
  return "#5865F2";
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
    button_text: "สร้าง Ticket ใหม่",
    button_style: "primary",
    button_emoji: "🎫",
    button_color: "#5865F2",
    categories: [],
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
    model: "gemini-3.5-flash",
    api_key: "",
    is_active: true,
    channel_id: "",
    channel_ids: [],
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
  const [inputChannelUid, setInputChannelUid] = useState("");

  // Knowledge Base State
  const [kbArticles, setKbArticles] = useState<KnowledgeArticle[]>([]);
  const [newKbTitle, setNewKbTitle] = useState("");
  const [newKbContent, setNewKbContent] = useState("");
  const [newKbImageUrl, setNewKbImageUrl] = useState("");
  const [newKbTags, setNewKbTags] = useState("");
  const [addingKb, setAddingKb] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
  const [isCustomServer, setIsCustomServer] = useState(false);

  const isLoggedIn = Boolean(profile);
  const hasBotInCurrentServer = (botGuilds || []).some((g) => g.id === config.guild_id) || Boolean(config.guild_id && isCustomServer);

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
            if (!prev.guild_id || !data.guilds!.some((g) => g.id === prev.guild_id)) {
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

    let isMounted = true;
    fetch(`/api/discord/guilds?bot=ticket&guildId=${config.guild_id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load guild channels/roles");
        return res.json();
      })
      .then((data: { channels?: DiscordChannel[]; categories?: DiscordChannel[]; roles?: DiscordRole[] }) => {
        if (!isMounted) return;
        setChannels(data.channels || []);
        setCategories(data.categories || []);
        setRoles(data.roles || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Could not load channels/roles:", err);
      });

    return () => {
      isMounted = false;
    };
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
            channel_id: data.ai_config?.channel_id ?? prev.ai_config.channel_id ?? "",
            channel_ids: Array.isArray(data.ai_config?.channel_ids)
              ? data.ai_config.channel_ids
              : data.ai_config?.channel_id ? [data.ai_config.channel_id] : (prev.ai_config.channel_ids || []),
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

      const chosenButtonColor = config.embed_customization.button_color || "#5865F2";
      const resolvedButtonStyle = colorToDiscordStyle(chosenButtonColor);

      const updates: any = {
        guild_id: config.guild_id,
        guild_name: activeServerName,
        embed_customization: {
          panel_title: config.embed_customization.panel_title || "🎫 ระบบ Support Ticket",
          panel_description: config.embed_customization.panel_description || "กดปุ่มด้านล่างเพื่อสร้าง Ticket ใหม่",
          panel_color: config.embed_customization.panel_color || "#5865F2",
          button_text: config.embed_customization.button_text || "สร้าง Ticket ใหม่",
          button_style: resolvedButtonStyle,
          button_emoji: config.embed_customization.button_emoji || "🎫",
          button_color: chosenButtonColor,
          welcome_message: config.embed_customization.welcome_message || "สวัสดีครับ ทีมงานจะเข้ามาช่วยเหลือในไม่ช้า",
          footer_text: config.embed_customization.footer_text || "Powered by YMM-TICKET",
          categories: config.embed_customization.categories || [],
        },
        ticket_config: config.ticket_config,
        ai_config: {
          provider: config.ai_config.provider || "gemini",
          model: config.ai_config.model || "gemini-3.5-flash",
          is_active: Boolean(config.ai_config.is_active),
          channel_id: (config.ai_config.channel_ids && config.ai_config.channel_ids[0]) || (config.ai_config.channel_id ? config.ai_config.channel_id.trim() : null),
          channel_ids: config.ai_config.channel_ids || (config.ai_config.channel_id ? [config.ai_config.channel_id.trim()] : []),
        },
        updated_at: serverTimestamp(),
      };

      // If user typed a new API Key in web form
      if (config.ai_config.api_key && config.ai_config.api_key.trim()) {
        updates.ai_config.raw_api_key_web = config.ai_config.api_key.trim();
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

  // Handle image file upload from device
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("ขนาดไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ขนาดไม่เกิน 10MB");
      return;
    }

    setUploadingImage(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "อัปโหลดรูปภาพล้มเหลว");
      }

      setNewKbImageUrl(data.url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // Add Knowledge Base Article
  const handleAddKb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      alert("กรุณาเข้าสู่ระบบ Discord ก่อนเพิ่มบทความ");
      return;
    }
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
        category: "general",
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
    if (!profile) {
      alert("กรุณาเข้าสู่ระบบ Discord ก่อน");
      return;
    }
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

          {/* Right Header Actions: Server Selector, Profile & Save Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Server Selector Dropdown or Custom Input */}
            {botGuilds.length > 0 && !isCustomServer ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>เซิร์ฟเวอร์:</span>
                <select
                  value={config.guild_id}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    setChannels([]);
                    setCategories([]);
                    setRoles([]);
                    setKbArticles([]);
                    setRecentTickets([]);
                    if (selectedVal === "custom") {
                      setIsCustomServer(true);
                    } else {
                      const selected = botGuilds.find((g) => g.id === selectedVal);
                      setConfig((prev) => ({
                        ...prev,
                        guild_id: selectedVal,
                        guild_name: selected ? selected.name : prev.guild_name
                      }));
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {botGuilds.map((g) => (
                    <option key={g.id} value={g.id} style={{ background: "#0c1322", color: "#fff" }}>
                      {g.name}
                    </option>
                  ))}
                  <option value="custom" style={{ background: "#0c1322", color: "#cbd5e1" }}>
                    Custom Server ID...
                  </option>
                </select>
              </div>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Server ID:</span>
                <input
                  type="text"
                  value={config.guild_id}
                  onChange={(e) => setConfig({ ...config, guild_id: e.target.value })}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    width: "150px",
                    outline: "none"
                  }}
                  placeholder="ID เซิร์ฟเวอร์..."
                />
                {botGuilds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCustomServer(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    ย้อนกลับ
                  </button>
                )}
              </div>
            )}

            {/* Profile Avatar Badge or Login Button */}
            {profile ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "4px 10px",
                borderRadius: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <Image
                  src={
                    profile.avatar
                      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
                      : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 5}.png`
                  }
                  alt=""
                  width={24}
                  height={24}
                  style={{ borderRadius: "50%" }}
                  unoptimized
                />
                <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600 }}>
                  {profile.globalName || profile.username}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setProfile(null);
                    window.location.reload();
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "0.75rem",
                    cursor: "pointer"
                  }}
                  title="ออกจากระบบ"
                >
                  ออก
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/discord?redirect=/dashboard-ticket"
                style={{
                  background: "#5865F2",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center"
                }}
              >
                Log In Discord
              </a>
            )}

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

                  {/* Button Customization Studio */}
                  <div style={{ background: "#0b1329", border: "1px solid #1e293b", borderRadius: "10px", padding: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
                          <span>🎛️</span> ปรับแต่งปุ่มกด Ticket (Ticket Button Studio)
                        </label>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          กำหนดข้อความ อีโมจิ สีกำหนดเอง (Custom Hex Color) และสไตล์ปุ่ม Discord
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                      {/* Button Text */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                          ข้อความบนปุ่ม (Button Text):
                        </label>
                        <input
                          type="text"
                          value={config.embed_customization.button_text || ""}
                          onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            embed_customization: { ...prev.embed_customization, button_text: e.target.value }
                          }))}
                          placeholder="สร้าง Ticket ใหม่"
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

                      {/* Button Emoji */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                          ไอคอน/อีโมจิหน้าปุ่ม (Emoji / Icon):
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            value={config.embed_customization.button_emoji || "🎫"}
                            onChange={(e) => setConfig((prev) => ({
                              ...prev,
                              embed_customization: { ...prev.embed_customization, button_emoji: e.target.value }
                            }))}
                            placeholder="🎫"
                            style={{
                              width: "70px",
                              textAlign: "center",
                              background: "#0f172a",
                              border: "1px solid #334155",
                              borderRadius: "8px",
                              padding: "10px",
                              color: "#fff",
                              fontSize: "1.1rem"
                            }}
                          />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                            {["🎫", "📩", "💬", "⭐", "🟢", "🔴", "🟣", "🟡", "💎", "🔥", "👑", "✨"].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setConfig((prev) => ({
                                  ...prev,
                                  embed_customization: { ...prev.embed_customization, button_emoji: emoji }
                                }))}
                                style={{
                                  background: config.embed_customization.button_emoji === emoji ? "#3b82f6" : "#1e293b",
                                  border: "1px solid #334155",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                  transition: "all 0.15s ease"
                                }}
                                title={`เลือก ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Discord Native Button Style Cards */}
                    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1" }}>
                          🔘 4 สีมาตรฐานทางการของปุ่ม Discord (Official Button Styles):
                        </label>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          คลิกเลือกสีปุ่มที่คุณต้องการให้แสดงบนหน้าต่างแชท Discord
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                        {[
                          { id: "primary", name: "Blurple (น้ำเงิน)", hex: "#5865F2", desc: "สไตล์ Primary" },
                          { id: "success", name: "Green (เขียว)", hex: "#248046", desc: "สไตล์ Success" },
                          { id: "danger", name: "Red (แดง)", hex: "#DA373C", desc: "สไตล์ Danger" },
                          { id: "secondary", name: "Gray (เทา)", hex: "#4E5058", desc: "สไตล์ Secondary" },
                        ].map((btn) => {
                          const isSelected = (config.embed_customization.button_style || "primary") === btn.id;
                          return (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={() => {
                                setConfig((prev) => ({
                                  ...prev,
                                  embed_customization: {
                                    ...prev.embed_customization,
                                    button_style: btn.id as any,
                                    button_color: btn.hex
                                  }
                                }));
                              }}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "6px",
                                background: isSelected ? "rgba(59, 130, 246, 0.2)" : "#1e293b",
                                border: isSelected ? "2px solid #3b82f6" : "1px solid #334155",
                                borderRadius: "8px",
                                padding: "12px 10px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                textAlign: "center"
                              }}
                            >
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  background: btn.hex,
                                  boxShadow: isSelected ? "0 0 10px " + btn.hex : "none"
                                }}
                              />
                              <span style={{ fontSize: "0.8rem", color: isSelected ? "#fff" : "#cbd5e1", fontWeight: isSelected ? 700 : 500 }}>
                                {btn.name}
                              </span>
                              <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                                {btn.desc} {isSelected ? "✓" : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* 1-Click Color Themes with Matching Emoji */}
                      <div style={{ borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1" }}>
                            ✨ ทางลัดจัดธีมสีพร้อมอีโมจิ (1-Click Theme Matcher):
                          </label>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                            คลิกเพื่อปรับสีปุ่มและไอคอนให้ออกมาเป็นธีมเดียวกัน
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" }}>
                          {[
                            { name: "Violet", emoji: "🟣", style: "primary", hex: "#8B5CF6" },
                            { name: "Gold", emoji: "🟡", style: "primary", hex: "#F59E0B" },
                            { name: "Pink", emoji: "🌸", style: "danger", hex: "#EC4899" },
                            { name: "Cyan", emoji: "💎", style: "primary", hex: "#06B6D4" },
                            { name: "Orange", emoji: "🔥", style: "danger", hex: "#F97316" },
                            { name: "Emerald", emoji: "🟢", style: "success", hex: "#10B981" },
                            { name: "Ruby", emoji: "🔴", style: "danger", hex: "#EF4444" },
                            { name: "Dark", emoji: "⚪", style: "secondary", hex: "#4B5563" },
                            { name: "Blurple", emoji: "🎫", style: "primary", hex: "#5865F2" },
                          ].map((theme) => {
                            const isThemeSelected =
                              config.embed_customization.button_emoji === theme.emoji &&
                              config.embed_customization.button_style === theme.style;
                            return (
                              <button
                                key={theme.name}
                                type="button"
                                onClick={() => {
                                  setConfig((prev) => ({
                                    ...prev,
                                    embed_customization: {
                                      ...prev.embed_customization,
                                      button_style: theme.style as any,
                                      button_emoji: theme.emoji,
                                      button_color: theme.hex
                                    }
                                  }));
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  background: isThemeSelected ? "rgba(59, 130, 246, 0.2)" : "#1e293b",
                                  border: isThemeSelected ? "2px solid #3b82f6" : "1px solid #334155",
                                  borderRadius: "6px",
                                  padding: "6px 8px",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease"
                                }}
                              >
                                <span style={{ fontSize: "0.95rem" }}>{theme.emoji}</span>
                                <span style={{ fontSize: "0.75rem", color: isThemeSelected ? "#fff" : "#cbd5e1", fontWeight: isThemeSelected ? 700 : 500 }}>
                                  {theme.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "6px", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "1.2rem", marginTop: "2px" }}>💡</span>
                      <div style={{ fontSize: "0.78rem", color: "#93c5fd", lineHeight: 1.5 }}>
                        <strong>ทำไม Discord ถึงไม่มีปุ่มสีม่วงหรือสีเหลือง?</strong>
                        <div style={{ color: "#cbd5e1", marginTop: "4px" }}>
                          Discord API กำหนดให้ปุ่ม Interaction Component ทั่วโลกมีได้เพียง <strong>4 สีมาตรฐาน</strong> (น้ำเงิน, เขียว, แดง, เทา) ไม่สามารถใส่โค้ดสี Hex อิสระบนตัวปุ่มได้
                        </div>
                        <div style={{ color: "#93c5fd", marginTop: "4px" }}>
                          ✨ <strong>วิธีแต่งธีมสีม่วง ทอง ชมพู หรือฟ้าให้สวยงาม:</strong> แนะนำให้ใช้ <strong>สีแถบ Embed ด้านบน</strong> (ซึ่งรองรับโค้ดสี Hex 16.7 ล้านสีได้เต็มรูปแบบ) ร่วมกับ <strong>ไอคอนอีโมจิสีประจำธีม</strong> (เช่น 🟣, 🟡, 🌸, 💎) หน้าข้อความปุ่ม
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category Fields Customization */}
                  <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>
                          🏷️ หมวดหมู่บริการใน Panel (Category Fields)
                        </label>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          หัวข้อและคำอธิบายหมวดหมู่ที่จะแสดงในกล่อง Embed บน Discord (เช่น Technical Support, Billing ฯลฯ)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentCats = config.embed_customization.categories || [];
                          if (currentCats.length >= 10) {
                            alert("สามารถเพิ่มได้สูงสุด 10 หมวดหมู่");
                            return;
                          }
                          setConfig((prev) => ({
                            ...prev,
                            embed_customization: {
                              ...prev.embed_customization,
                              categories: [...(prev.embed_customization.categories || []), { name: "", value: "" }]
                            }
                          }));
                        }}
                        style={{
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        ➕ เพิ่มหมวดหมู่
                      </button>
                    </div>

                    {(!config.embed_customization.categories || config.embed_customization.categories.length === 0) ? (
                      <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: "0.85rem", border: "1px dashed #334155", borderRadius: "6px" }}>
                        ไม่มีหมวดหมู่ (Embed จะไม่แสดงฟิลด์หมวดหมู่) หรือกด &quot;➕ เพิ่มหมวดหมู่&quot; หากต้องการเพิ่มหัวข้อใน Embed
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {config.embed_customization.categories.map((cat, idx) => (
                          <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8", marginBottom: "4px" }}>
                                ชื่อหมวดหมู่ #{idx + 1} (Field Name)
                              </span>
                              <input
                                type="text"
                                value={cat.name}
                                onChange={(e) => {
                                  const newCats = [...(config.embed_customization.categories || [])];
                                  newCats[idx] = { ...newCats[idx], name: e.target.value };
                                  setConfig((prev) => ({
                                    ...prev,
                                    embed_customization: { ...prev.embed_customization, categories: newCats }
                                  }));
                                }}
                                placeholder="เช่น 💻 Technical Support"
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
                            <div style={{ flex: 1 }}>
                              <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8", marginBottom: "4px" }}>
                                รายละเอียด (Field Value)
                              </span>
                              <input
                                type="text"
                                value={cat.value}
                                onChange={(e) => {
                                  const newCats = [...(config.embed_customization.categories || [])];
                                  newCats[idx] = { ...newCats[idx], value: e.target.value };
                                  setConfig((prev) => ({
                                    ...prev,
                                    embed_customization: { ...prev.embed_customization, categories: newCats }
                                  }));
                                }}
                                placeholder="เช่น ปัญหาทางเทคนิค หรือข้อสงสัยทั่วไป"
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
                              type="button"
                              onClick={() => {
                                const newCats = (config.embed_customization.categories || []).filter((_, i) => i !== idx);
                                setConfig((prev) => ({
                                  ...prev,
                                  embed_customization: { ...prev.embed_customization, categories: newCats }
                                }));
                              }}
                              style={{
                                marginTop: "18px",
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                color: "#f87171",
                                borderRadius: "6px",
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontSize: "0.85rem"
                              }}
                              title="ลบหมวดหมู่นี้"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Real-time Discord Panel Sync Action */}
                  <div style={{
                    marginTop: "10px",
                    padding: "16px 20px",
                    background: "rgba(88, 101, 242, 0.08)",
                    border: "1px solid rgba(88, 101, 242, 0.3)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px"
                  }}>
                    <div>
                      <b style={{ color: "#fff", fontSize: "0.95rem" }}>🚀 ซิงค์สี & ข้อความ Panel ไปยัง Discord ทันที</b>
                      <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "2px 0 0" }}>
                        บอทจะอัปเดตสีและข้อความของ Embed บน Discord ทันที หรือส่งข้อความ Panel เข้าห้องที่เลือก
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <select
                        id="panel-target-channel"
                        defaultValue={config.ticket_config.log_channel_id || channels[0]?.id || ""}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "#fff",
                          fontSize: "0.85rem"
                        }}
                      >
                        {channels.length === 0 ? (
                          <option value="">-- ไม่พบห้องข้อความ --</option>
                        ) : (
                          channels.map(c => (
                            <option key={c.id} value={c.id}>#{c.name}</option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const selectEl = document.getElementById("panel-target-channel") as HTMLSelectElement;
                          const channelId = selectEl?.value || config.ticket_config.log_channel_id || channels[0]?.id;
                          if (!channelId) {
                            alert("กรุณาเลือกห้องข้อความก่อนครับ");
                            return;
                          }
                          await handleSave();
                          const docRef = doc(ticketDb, "guilds", config.guild_id);
                          await setDoc(docRef, {
                            ticket_config: {
                              ...config.ticket_config,
                              sync_panel_channel_id: channelId,
                              sync_panel_trigger: Date.now(),
                            }
                          }, { merge: true });
                          alert("🚀 ส่งคำสั่งอัปเดต Panel ไปยัง Discord เรียบร้อย! ตรวจสอบห้องใน Discord ได้ทันที");
                        }}
                        style={{
                          background: "linear-gradient(135deg, #5865F2, #4752C4)",
                          color: "#fff",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "6px",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(88, 101, 242, 0.4)"
                        }}
                      >
                        ⚡ ซิงค์เข้า Discord
                      </button>
                    </div>
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
                        AI จะคอยตอบคำถามและอ่านรูปภาพในห้อง Ticket และห้องที่ระบุ UID ไว้
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

                  {/* AI Channel UIDs Management */}
                  <div style={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "10px",
                    padding: "16px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
                          💬 กำหนดเลขห้อง (UID) ให้ AI อ่านเนื้อหาและรูปภาพ
                        </label>
                        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                          ป้อนเลข UID ของห้องใน Discord แล้วกด <b>&quot;➕ เพิ่มห้อง&quot;</b> เพื่อให้ AI คอยอ่านข้อความและวิเคราะห์รูปภาพ (Vision) เพื่อตอบคำถามทันที (เพิ่มได้หลายห้อง)
                        </p>
                      </div>
                      {((config.ai_config.channel_ids && config.ai_config.channel_ids.length > 0) || config.ai_config.channel_id) && (
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({
                            ...prev,
                            ai_config: { ...prev.ai_config, channel_id: "", channel_ids: [] }
                          }))}
                          style={{
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            color: "#f87171",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            cursor: "pointer"
                          }}
                        >
                          ✕ ลบห้องทั้งหมด
                        </button>
                      )}
                    </div>

                    {/* Add Room UID Row */}
                    <div style={{ display: "grid", gridTemplateColumns: channels && channels.length > 0 ? "1fr 1fr auto" : "1fr auto", gap: "10px", alignItems: "end" }}>
                      <div>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#cbd5e1", marginBottom: "4px", fontWeight: 500 }}>
                          กรอก UID เลขห้องโดยตรง (Channel ID):
                        </span>
                        <input
                          type="text"
                          value={inputChannelUid}
                          onChange={(e) => setInputChannelUid(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const matches = inputChannelUid.match(/\d{17,21}/g) || (inputChannelUid.trim() ? [inputChannelUid.trim().replace(/[<#>]/g, "")] : []);
                              if (matches.length === 0) return;
                              const currentList = config.ai_config.channel_ids || (config.ai_config.channel_id ? [config.ai_config.channel_id] : []);
                              const newUids = matches.filter(id => !currentList.includes(id));
                              if (newUids.length === 0) {
                                alert("ห้องนี้มีในรายการแล้ว");
                                return;
                              }
                              const updated = [...currentList, ...newUids];
                              setConfig((prev) => ({
                                ...prev,
                                ai_config: {
                                  ...prev.ai_config,
                                  channel_ids: updated,
                                  channel_id: updated[0] || "",
                                }
                              }));
                              setInputChannelUid("");
                            }
                          }}
                          placeholder="เช่น 123456789012345678"
                          style={{
                            width: "100%",
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            padding: "9px 12px",
                            color: "#fff",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>

                      {channels && channels.length > 0 && (
                        <div>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#cbd5e1", marginBottom: "4px", fontWeight: 500 }}>
                            หรือเลือกห้องจาก Discord:
                          </span>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setInputChannelUid(e.target.value);
                              }
                            }}
                            style={{
                              width: "100%",
                              background: "#1e293b",
                              border: "1px solid #334155",
                              borderRadius: "8px",
                              padding: "9px 12px",
                              color: "#fff",
                              fontSize: "0.85rem"
                            }}
                          >
                            <option value="">-- เลือกห้องเพื่อดึง UID --</option>
                            {channels.filter((c: any) => c.type === 0 || !c.type).map((c: any) => (
                              <option key={c.id} value={c.id}>
                                #{c.name} ({c.id})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const matches = inputChannelUid.match(/\d{17,21}/g) || (inputChannelUid.trim() ? [inputChannelUid.trim().replace(/[<#>]/g, "")] : []);
                          if (matches.length === 0) {
                            alert("กรุณากรอก UID เลขห้องก่อนกดเพิ่ม");
                            return;
                          }
                          const currentList = config.ai_config.channel_ids || (config.ai_config.channel_id ? [config.ai_config.channel_id] : []);
                          const newUids = matches.filter(id => !currentList.includes(id));
                          if (newUids.length === 0) {
                            alert("ห้องนี้มีในรายการแล้ว");
                            return;
                          }
                          const updated = [...currentList, ...newUids];
                          setConfig((prev) => ({
                            ...prev,
                            ai_config: {
                              ...prev.ai_config,
                              channel_ids: updated,
                              channel_id: updated[0] || "",
                            }
                          }));
                          setInputChannelUid("");
                        }}
                        style={{
                          background: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "9px 18px",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          height: "38px",
                          whiteSpace: "nowrap"
                        }}
                      >
                        ➕ เพิ่มห้อง
                      </button>
                    </div>

                    {/* Active Channels List */}
                    <div style={{ marginTop: "16px" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: "8px" }}>
                        📋 รายการห้องที่ AI จะเข้าไปอ่านและตอบ ({((config.ai_config.channel_ids && config.ai_config.channel_ids.length > 0) ? config.ai_config.channel_ids : (config.ai_config.channel_id ? [config.ai_config.channel_id] : [])).length} ห้อง):
                      </span>

                      {(!config.ai_config.channel_ids || config.ai_config.channel_ids.length === 0) && !config.ai_config.channel_id ? (
                        <div style={{ padding: "14px", border: "1px dashed #334155", borderRadius: "8px", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
                          ยังไม่มีห้องที่กำหนด (กรอก UID เลขห้องด้านบน แล้วกด <b>&quot;➕ เพิ่มห้อง&quot;</b>)
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {((config.ai_config.channel_ids && config.ai_config.channel_ids.length > 0)
                            ? config.ai_config.channel_ids
                            : (config.ai_config.channel_id ? [config.ai_config.channel_id] : [])
                          ).map((cId) => {
                            const found = channels.find((c: any) => c.id === cId);
                            return (
                              <div
                                key={cId}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  background: "#1e293b",
                                  border: "1px solid #334155",
                                  borderRadius: "8px",
                                  padding: "10px 14px"
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <span style={{ fontSize: "1.1rem" }}>💬</span>
                                  <div>
                                    <b style={{ color: "#fff", fontSize: "0.88rem" }}>
                                      {found ? `#${found.name}` : "ห้อง Discord"}
                                    </b>
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>
                                      UID: {cId}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentList = config.ai_config.channel_ids || (config.ai_config.channel_id ? [config.ai_config.channel_id] : []);
                                    const nextList = currentList.filter((id) => id !== cId);
                                    setConfig((prev) => ({
                                      ...prev,
                                      ai_config: {
                                        ...prev.ai_config,
                                        channel_ids: nextList,
                                        channel_id: nextList[0] || "",
                                      }
                                    }));
                                  }}
                                  style={{
                                    background: "rgba(239, 68, 68, 0.15)",
                                    border: "1px solid rgba(239, 68, 68, 0.4)",
                                    color: "#f87171",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    cursor: "pointer"
                                  }}
                                >
                                  ✕ ลบออก
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                      {["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gpt-4o-mini"].map((m) => (
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

                    {/* Image Attachment (Device Upload & URL) */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>
                        🖼️ รูปภาพประกอบบทความ (ให้ AI ใช้อ้างอิงและส่งให้ผู้ใช้ดู):
                      </label>
                      
                      {newKbImageUrl ? (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          background: "#0f172a",
                          border: "1px solid #3b82f6",
                          padding: "10px",
                          borderRadius: "8px"
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={newKbImageUrl}
                            alt="KB Preview"
                            style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #334155" }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>✅ มีรูปภาพแนบแล้ว</div>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {newKbImageUrl}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewKbImageUrl("")}
                            style={{
                              background: "#ef4444",
                              border: "none",
                              color: "#fff",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              cursor: "pointer"
                            }}
                          >
                            🗑️ ลบรูป
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            padding: "12px",
                            border: "2px dashed #475569",
                            borderRadius: "8px",
                            background: "#1e293b",
                            cursor: uploadingImage ? "not-allowed" : "pointer",
                            color: uploadingImage ? "#94a3b8" : "#38bdf8",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            transition: "all 0.2s"
                          }}>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={handleImageFileSelect}
                              disabled={uploadingImage}
                            />
                            {uploadingImage ? (
                              <>⏳ กำลังอัปโหลดรูปภาพ...</>
                            ) : (
                              <>📁 คลิกเลือกรูปภาพจากเครื่อง (PNG, JPG, WEBP)</>
                            )}
                          </label>

                          {uploadError && (
                            <div style={{ fontSize: "0.75rem", color: "#ef4444" }}>
                              ⚠️ {uploadError}
                            </div>
                          )}

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>หรือวางลิงก์:</span>
                            <input
                              type="url"
                              value={newKbImageUrl}
                              onChange={(e) => setNewKbImageUrl(e.target.value)}
                              placeholder="https://..."
                              style={{
                                flex: 1,
                                background: "#0f172a",
                                border: "1px solid #334155",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                color: "#fff",
                                fontSize: "0.75rem"
                              }}
                            />
                          </div>
                        </div>
                      )}
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

                    {/* Categories fields (if any) */}
                    {config.embed_customization.categories && config.embed_customization.categories.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px", marginBottom: "12px" }}>
                        {config.embed_customization.categories.map((cat, idx) => (
                          <div key={idx} style={{ background: "#1e1f22", padding: "6px 8px", borderRadius: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>
                            <span style={{ color: "#fff", fontWeight: 600 }}>{cat.name || "หัวข้อหมวดหมู่"}</span>
                            {cat.value ? ` — ${cat.value}` : ""}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      {config.embed_customization.footer_text || "Powered by YMM-TICKET"}
                    </div>
                  </div>

                  {/* Interactive Button Preview (Real Discord Appearance) */}
                  <div style={{ marginTop: "10px" }}>
                    <button
                      type="button"
                      style={{
                        background: getDiscordButtonColor(config.embed_customization.button_style),
                        color: "#fff",
                        border: "none",
                        padding: "9px 16px",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "default",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                      }}
                    >
                      <span style={{ fontSize: "1rem" }}>{config.embed_customization.button_emoji || "🎫"}</span>
                      <span>{config.embed_customization.button_text || "สร้าง Ticket ใหม่"}</span>
                    </button>
                    <div style={{ marginTop: "6px", fontSize: "0.72rem", color: "#94a3b8" }}>
                      สไตล์ปุ่มบน Discord: <strong style={{ color: "#fff" }}>
                        {config.embed_customization.button_style === "success" ? "🟢 Success (เขียว)" :
                         config.embed_customization.button_style === "danger" ? "🔴 Danger (แดง)" :
                         config.embed_customization.button_style === "secondary" ? "⚪ Secondary (เทา)" :
                         "🔵 Primary (น้ำเงิน Blurple)"}
                      </strong>
                    </div>
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
