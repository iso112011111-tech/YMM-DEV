"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/app/img/logo.png";

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
  has_api_key?: boolean;
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
    has_api_key: false,
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

  // API Key Validation State
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "validating" | "success" | "error">("idle");
  const [apiKeyMessage, setApiKeyMessage] = useState<string>("");

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

  // 4. Server API Fetch for Guild Config
  const fetchTicketConfig = async (targetGuildId: string) => {
    if (!targetGuildId) return;
    try {
      const res = await fetch(`/api/dashboard/ticket-config?guild_id=${targetGuildId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          const cfg = data.config;
          setConfig((prev) => ({
            ...prev,
            guild_id: targetGuildId,
            guild_name: cfg.guild_name || prev.guild_name,
            embed_customization: {
              ...DEFAULT_CONFIG.embed_customization,
              ...(cfg.embed_customization || {}),
            },
            ticket_config: {
              ...DEFAULT_CONFIG.ticket_config,
              ...(cfg.ticket_config || {}),
            },
            ai_config: {
              ...DEFAULT_CONFIG.ai_config,
              ...(cfg.ai_config || {}),
              channel_id: cfg.ai_config?.channel_id || "",
              channel_ids: Array.isArray(cfg.ai_config?.channel_ids)
                ? cfg.ai_config.channel_ids
                : (cfg.ai_config?.channel_id ? [cfg.ai_config.channel_id] : []),
              api_key: prev.ai_config.api_key || "", // keep current input in form
            },
            stats: {
              ...DEFAULT_CONFIG.stats,
              ...(cfg.stats || {}),
            }
          }));
        }
      }
    } catch (err) {
      console.warn("Ticket config fetch notice:", err);
    }
  };

  // 5. Server API Fetch for Knowledge Base
  const fetchKnowledgeBase = async (targetGuildId: string) => {
    if (!targetGuildId) return;
    try {
      const res = await fetch(`/api/dashboard/ticket-knowledge?guild_id=${targetGuildId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.articles)) {
          setKbArticles(data.articles);
        }
      }
    } catch (err) {
      console.warn("Knowledge base fetch notice:", err);
    }
  };

  // 6. Server API Fetch for Recent Tickets
  const fetchRecentTickets = async (targetGuildId: string) => {
    if (!targetGuildId) return;
    try {
      const res = await fetch(`/api/dashboard/ticket-list?guild_id=${targetGuildId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tickets)) {
          setRecentTickets(data.tickets);
        }
      }
    } catch (err) {
      console.warn("Recent tickets fetch notice:", err);
    }
  };

  useEffect(() => {
    if (!config.guild_id) return;

    const loadAll = async () => {
      await fetchTicketConfig(config.guild_id);
      await fetchKnowledgeBase(config.guild_id);
      await fetchRecentTickets(config.guild_id);
    };

    loadAll();
  }, [config.guild_id]);

  // Save Config via Server API Route with Server-Side AES-256-GCM Encryption
  const handleSave = async () => {
    if (!profile) {
      alert("กรุณาเข้าสู่ระบบ Discord ก่อนบันทึกการตั้งค่า");
      return;
    }
    if (!hasBotInCurrentServer) {
      alert("ไม่สามารถบันทึกได้ เนื่องจากเซิร์ฟเวอร์นี้ยังไม่ได้ติดตั้งบอท YMM-TICKET");
      return;
    }

    const hasNewApiKey = Boolean(config.ai_config.api_key && config.ai_config.api_key.trim());
    if (hasNewApiKey) {
      setApiKeyStatus("validating");
      setApiKeyMessage("กำลังตรวจสอบ API Key...");
    }

    setSaving(true);
    setSaveStatus("idle");

    try {
      const activeServerName = botGuilds.find((g) => g.id === config.guild_id)?.name || config.guild_name || "Server";
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
      };

      // Safely pass plain API key to server route for immediate AES-256-GCM encryption
      if (config.ai_config.api_key && config.ai_config.api_key.trim()) {
        updates.ai_config.api_key = config.ai_config.api_key.trim();
      }

      const res = await fetch("/api/dashboard/ticket-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.field === "api_key") {
          setApiKeyStatus("error");
          setApiKeyMessage(errJson.error || "API Key ไม่ถูกต้อง");
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 4000);
          return;
        }
        throw new Error(errJson.error || "บันทึกข้อมูลล้มเหลว");
      }

      // Clear the typed key from local form state and display success
      if (hasNewApiKey) {
        setApiKeyStatus("success");
        setApiKeyMessage("✅ ตรวจสอบสำเร็จ บันทึกเรียบร้อย");
        setConfig((prev) => ({
          ...prev,
          ai_config: {
            ...prev.ai_config,
            api_key: "",
            has_api_key: true,
          },
        }));
        setTimeout(() => {
          setApiKeyStatus("idle");
          setApiKeyMessage("");
        }, 6000);
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (error: any) {
      console.error("Save config error:", error);
      if (hasNewApiKey) {
        setApiKeyStatus("error");
        setApiKeyMessage(error.message || "การตรวจสอบ API Key ล้มเหลว");
      }
      alert(error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
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

      const res = await fetch("/api/dashboard/ticket-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: config.guild_id,
          title: newKbTitle.trim(),
          content: newKbContent.trim(),
          image_url: newKbImageUrl.trim() || null,
          tags: tagsArray,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "เพิ่มบทความล้มเหลว");
      }

      setNewKbTitle("");
      setNewKbContent("");
      setNewKbImageUrl("");
      setNewKbTags("");
      await fetchKnowledgeBase(config.guild_id);
      alert("✅ เพิ่มบทความลงคลังความรู้สำเร็จ!");
    } catch (err: any) {
      console.error("Add KB error:", err);
      alert("❌ เพิ่มบทความล้มเหลว: " + err.message);
    } finally {
      setAddingKb(false);
    }
  };

  // Delete Knowledge Base Article via Server API Route
  const handleDeleteKb = async (articleId: string, title: string) => {
    if (!profile) {
      alert("กรุณาเข้าสู่ระบบ Discord ก่อน");
      return;
    }
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบทความ "${title}"?`)) return;

    try {
      const res = await fetch(`/api/dashboard/ticket-knowledge?guild_id=${config.guild_id}&article_id=${articleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "ลบบทความล้มเหลว");
      }

      await fetchKnowledgeBase(config.guild_id);
    } catch (err: any) {
      console.error("Delete KB error:", err);
      alert("ลบล้มเหลว: " + err.message);
    }
  };

  return (
    <div className="dash-root">
      {/* Top Header Navbar */}
      <header className="dash-header">
        <div className="dash-header-inner">
          {/* Logo & Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
              <Image src={logo} alt="Logo" width={32} height={32} style={{ borderRadius: "8px" }} />
              <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.5px", color: "#fff" }}>
                YMM<span style={{ color: "#3b82f6" }}>.TICKET</span>
              </span>
            </Link>
            <span style={{
              background: "rgba(59, 130, 246, 0.12)",
              color: "#60a5fa",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "6px",
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}>
              Dashboard
            </span>
          </div>

          {/* Controls: Server Selector, Profile, Save Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Server Selector */}
            {botGuilds.length > 0 && !isCustomServer ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "4px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>เซิร์ฟเวอร์:</span>
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
                      setConfig({
                        ...DEFAULT_CONFIG,
                        guild_id: selectedVal,
                        guild_name: selected ? selected.name : "Server",
                      });
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    outline: "none",
                    cursor: "pointer",
                    maxWidth: "160px"
                  }}
                >
                  {botGuilds.map((g) => (
                    <option key={g.id} value={g.id} style={{ background: "#0c1322", color: "#fff" }}>
                      {g.name}
                    </option>
                  ))}
                  <option value="custom" style={{ background: "#0c1322", color: "#cbd5e1" }}>
                    + ระบุ Server ID เอง...
                  </option>
                </select>
              </div>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "4px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Server ID:</span>
                <input
                  type="text"
                  value={config.guild_id}
                  onChange={(e) => setConfig({ ...config, guild_id: e.target.value })}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    width: "130px",
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
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    ย้อนกลับ
                  </button>
                )}
              </div>
            )}

            {/* Profile Avatar & Logout */}
            {profile ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "4px 10px",
                borderRadius: "20px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <Image
                  src={
                    profile.avatar
                      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
                      : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 5}.png`
                  }
                  alt=""
                  width={22}
                  height={22}
                  style={{ borderRadius: "50%" }}
                  unoptimized
                />
                <span style={{ fontSize: "0.8rem", color: "#fff", fontWeight: 600, maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                    fontSize: "0.72rem",
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
                  background: "#3b82f6",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center"
                }}
              >
                Log In
              </a>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving || apiKeyStatus === "validating" || !hasBotInCurrentServer}
              style={{
                background: (saving || apiKeyStatus === "validating") 
                  ? "#475569" 
                  : saveStatus === "success" 
                    ? "#10b981" 
                    : "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "7px 16px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: (saving || apiKeyStatus === "validating" || !hasBotInCurrentServer) ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(59, 130, 246, 0.25)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap"
              }}
            >
              {apiKeyStatus === "validating"
                ? "⏳ กำลังตรวจสอบ API Key..."
                : saving 
                  ? "⏳ กำลังบันทึก..." 
                  : saveStatus === "success" 
                    ? "✓ บันทึกแล้ว" 
                    : "💾 บันทึกการตั้งค่า"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="dash-main">
        {/* Status Notice Banner if Bot not in server */}
        {!loadingGuilds && !hasBotInCurrentServer && (
          <div style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "12px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <b style={{ color: "#ef4444", fontSize: "0.9rem" }}>⚠️ บอท YMM-TICKET ยังไม่ได้อยู่ในเซิร์ฟเวอร์นี้</b>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "2px 0 0" }}>
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
                padding: "7px 14px",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.82rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              ➕ เชิญบอทเข้าเซิร์ฟเวอร์
            </a>
          </div>
        )}

        {/* Quota & Stats Overview Cards (Responsive 4-col desktop, 2-col mobile) */}
        <div className="dash-stats-grid">
          {/* Active Quota Card */}
          <div className="dash-stat-card">
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Ticket ที่เปิดอยู่</span>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>โควตา</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <span style={{ fontSize: "1.6rem", fontWeight: 800, color: config.stats.open_tickets >= 45 ? "#ef4444" : "#60a5fa" }}>
                {config.stats.open_tickets}
              </span>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>/ 50 เคส</span>
            </div>
            <div style={{
              width: "100%",
              height: "4px",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "2px",
              marginTop: "8px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${Math.min(100, (config.stats.open_tickets / 50) * 100)}%`,
                height: "100%",
                background: config.stats.open_tickets >= 45 ? "#ef4444" : "#3b82f6",
                transition: "width 0.3s ease"
              }} />
            </div>
          </div>

          {/* Total Tickets */}
          <div className="dash-stat-card">
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
              Ticket ทั้งหมดที่เคยเปิด
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", marginTop: "6px" }}>
              {config.stats.total_tickets} <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>เคส</span>
            </div>
          </div>

          {/* Average CSAT */}
          <div className="dash-stat-card">
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
              คะแนนความพึงพอใจ
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fbbf24", marginTop: "6px" }}>
              ⭐ {config.stats.avg_csat ? config.stats.avg_csat.toFixed(1) : "5.0"} <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>/ 5.0</span>
            </div>
          </div>

          {/* Knowledge Base Articles */}
          <div className="dash-stat-card">
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
              คลังความรู้ AI (FAQ)
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#34d399", marginTop: "6px" }}>
              {kbArticles.length} <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>บทความ</span>
            </div>
          </div>
        </div>

        {/* Modern Tabs Navigation Bar (Scrollable on Mobile) */}
        <div className="dash-tabs-bar">
          {[
            { id: "appearance", icon: "🎨", label: "ธีม & Embed" },
            { id: "system", icon: "⚙️", label: "ระบบ Ticket" },
            { id: "ai", icon: "🤖", label: "ผู้ช่วย AI (BYOK)" },
            { id: "kb", icon: "📚", label: `คลังความรู้ (${kbArticles.length})` },
            { id: "tickets", icon: "📊", label: `รายการเคส (${recentTickets.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`dash-tab-btn ${activeTab === tab.id ? "is-active" : ""}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: 🎨 APPEARANCE & EMBED PANEL (Split Grid with Live Preview)        */}
        {/* ========================================================================= */}
        {activeTab === "appearance" && (
          <div className="dash-split-grid">
            {/* Left: Form Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Card 1: Text Content */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <h3 className="dash-card-title">ข้อความบนแผง Ticket (Embed Panel)</h3>
                  <p className="dash-card-subtitle">กำหนดหัวข้อ คำอธิบาย และข้อความต้อนรับที่จะแสดงบน Discord</p>
                </div>

                <div className="dash-field">
                  <label className="dash-label">หัวข้อแผง Ticket (Panel Title):</label>
                  <input
                    type="text"
                    className="dash-input"
                    value={config.embed_customization.panel_title}
                    onChange={(e) => setConfig((prev) => ({
                      ...prev,
                      embed_customization: { ...prev.embed_customization, panel_title: e.target.value }
                    }))}
                    placeholder="เช่น 🎫 ระบบ Support Ticket"
                  />
                </div>

                <div className="dash-field">
                  <label className="dash-label">คำอธิบาย (Panel Description):</label>
                  <textarea
                    rows={3}
                    className="dash-textarea"
                    value={config.embed_customization.panel_description}
                    onChange={(e) => setConfig((prev) => ({
                      ...prev,
                      embed_customization: { ...prev.embed_customization, panel_description: e.target.value }
                    }))}
                    placeholder="ข้อความแนะนำและขั้นตอนการเปิด Ticket..."
                  />
                </div>

                <div className="dash-field">
                  <label className="dash-label">ข้อความต้อนรับเมื่อเปิดห้อง (Welcome Message):</label>
                  <textarea
                    rows={2}
                    className="dash-textarea"
                    value={config.embed_customization.welcome_message}
                    onChange={(e) => setConfig((prev) => ({
                      ...prev,
                      embed_customization: { ...prev.embed_customization, welcome_message: e.target.value }
                    }))}
                    placeholder="ข้อความแรกที่บอทจะส่งอัตโนมัติเมื่อห้อง Ticket ถูกสร้างขึ้น..."
                  />
                </div>

                <div className="dash-field">
                  <label className="dash-label">ข้อความท้าย Embed (Footer Text):</label>
                  <input
                    type="text"
                    className="dash-input"
                    value={config.embed_customization.footer_text}
                    onChange={(e) => setConfig((prev) => ({
                      ...prev,
                      embed_customization: { ...prev.embed_customization, footer_text: e.target.value }
                    }))}
                    placeholder="เช่น Powered by YMM-TICKET"
                  />
                </div>
              </div>

              {/* Card 2: Button & Color Style */}
              <div className="dash-card">
                <div className="dash-card-header">
                  <h3 className="dash-card-title">สีธีม & ปุ่มกดเปิด Ticket</h3>
                  <p className="dash-card-subtitle">ปรับแต่งสีแถบ Embed และข้อความบนปุ่มเปิด Ticket ใน Discord</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                  <div className="dash-field">
                    <label className="dash-label">ข้อความบนปุ่ม (Button Text):</label>
                    <input
                      type="text"
                      className="dash-input"
                      value={config.embed_customization.button_text || "สร้าง Ticket ใหม่"}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        embed_customization: { ...prev.embed_customization, button_text: e.target.value }
                      }))}
                      placeholder="เช่น สร้าง Ticket ใหม่"
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label">ไอคอนอีโมจิ (Button Emoji):</label>
                    <input
                      type="text"
                      className="dash-input"
                      value={config.embed_customization.button_emoji || "🎫"}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        embed_customization: { ...prev.embed_customization, button_emoji: e.target.value }
                      }))}
                      placeholder="เช่น 🎫 หรือ 💬"
                    />
                  </div>
                </div>

                {/* Color Presets */}
                <div style={{ marginBottom: "16px" }}>
                  <label className="dash-label" style={{ display: "block", marginBottom: "8px" }}>
                    เลือกสีธีมสำเร็จรูป:
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {PRESET_COLORS.map((color) => {
                      const isSelected = (config.embed_customization.panel_color || "").toLowerCase() === color.hex.toLowerCase();
                      return (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => {
                            const newStyle = colorToDiscordStyle(color.hex);
                            setConfig((prev) => ({
                              ...prev,
                              embed_customization: {
                                ...prev.embed_customization,
                                panel_color: color.hex,
                                button_color: color.hex,
                                button_style: newStyle,
                              }
                            }));
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            background: isSelected ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
                            border: isSelected ? `2px solid ${color.hex}` : "1px solid rgba(255, 255, 255, 0.08)",
                            color: "#fff",
                            fontSize: "0.8rem",
                            fontWeight: isSelected ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: color.hex }} />
                          <span>{color.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom HEX Color Picker */}
                <div className="dash-field">
                  <label className="dash-label">กำหนดรหัสสีเอง (HEX Code):</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="color"
                      value={config.embed_customization.panel_color || "#5865F2"}
                      onChange={(e) => {
                        const hexVal = e.target.value;
                        const newStyle = colorToDiscordStyle(hexVal);
                        setConfig((prev) => ({
                          ...prev,
                          embed_customization: {
                            ...prev.embed_customization,
                            panel_color: hexVal,
                            button_color: hexVal,
                            button_style: newStyle,
                          }
                        }));
                      }}
                      style={{
                        width: "42px",
                        height: "40px",
                        padding: 0,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "6px",
                        background: "transparent",
                        cursor: "pointer"
                      }}
                    />
                    <input
                      type="text"
                      className="dash-input"
                      value={config.embed_customization.panel_color || "#5865F2"}
                      onChange={(e) => {
                        const hexVal = e.target.value;
                        const newStyle = colorToDiscordStyle(hexVal);
                        setConfig((prev) => ({
                          ...prev,
                          embed_customization: {
                            ...prev.embed_customization,
                            panel_color: hexVal,
                            button_color: hexVal,
                            button_style: newStyle,
                          }
                        }));
                      }}
                      placeholder="#5865F2"
                      style={{ width: "140px" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      สไตล์ปุ่มบน Discord: <strong style={{ color: "#fff" }}>
                        {config.embed_customization.button_style === "success" ? "🟢 เขียว (Success)" :
                         config.embed_customization.button_style === "danger" ? "🔴 แดง (Danger)" :
                         config.embed_customization.button_style === "secondary" ? "⚪ เทา (Secondary)" :
                         "🔵 น้ำเงิน (Primary)"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Category Fields */}
              <div className="dash-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 className="dash-card-title">🏷️ หมวดหมู่บริการใน Panel (Category Fields)</h3>
                    <p className="dash-card-subtitle">หัวข้อและคำอธิบายที่จะแสดงใน Embed บน Discord</p>
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
                      cursor: "pointer"
                    }}
                  >
                    ➕ เพิ่มหมวดหมู่
                  </button>
                </div>

                {(!config.embed_customization.categories || config.embed_customization.categories.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: "0.82rem", border: "1px dashed rgba(255, 255, 255, 0.1)", borderRadius: "8px" }}>
                    ไม่มีหมวดหมู่เพิ่มเติม (Embed จะแสดงเฉพาะหัวข้อและคำอธิบายหลัก)
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {config.embed_customization.categories.map((cat, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", alignItems: "center" }}>
                        <input
                          type="text"
                          className="dash-input"
                          value={cat.name}
                          onChange={(e) => {
                            const newCats = [...(config.embed_customization.categories || [])];
                            newCats[idx] = { ...newCats[idx], name: e.target.value };
                            setConfig((prev) => ({
                              ...prev,
                              embed_customization: { ...prev.embed_customization, categories: newCats }
                            }));
                          }}
                          placeholder="ชื่อหมวด เช่น 💻 Support"
                        />
                        <input
                          type="text"
                          className="dash-input"
                          value={cat.value}
                          onChange={(e) => {
                            const newCats = [...(config.embed_customization.categories || [])];
                            newCats[idx] = { ...newCats[idx], value: e.target.value };
                            setConfig((prev) => ({
                              ...prev,
                              embed_customization: { ...prev.embed_customization, categories: newCats }
                            }));
                          }}
                          placeholder="รายละเอียด"
                        />
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
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.8rem"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 4: Instant Panel Synchronizer */}
              <div style={{
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px"
              }}>
                <div>
                  <b style={{ color: "#fff", fontSize: "0.9rem" }}>🚀 ซิงค์แผง Panel ไปยังห้องใน Discord ทันที</b>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "2px 0 0" }}>
                    ส่งข้อความ Embed ไปยังห้องที่เลือก เพื่อให้ผู้ใช้งานกดเปิด Ticket ได้ทันที
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <select
                    id="panel-target-channel"
                    defaultValue={config.ticket_config.log_channel_id || channels[0]?.id || ""}
                    className="dash-select"
                    style={{ width: "auto", minWidth: "160px" }}
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
                      const res = await fetch("/api/dashboard/ticket-config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          guild_id: config.guild_id,
                          sync_panel_channel_id: channelId,
                        }),
                      });
                      if (!res.ok) {
                        const errJson = await res.json().catch(() => ({}));
                        throw new Error(errJson.error || "ส่งคำสั่งซิงค์ล้มเหลว");
                      }
                      alert("🚀 ส่งคำสั่งอัปเดต Panel ไปยัง Discord เรียบร้อย! ตรวจสอบห้องใน Discord ได้ทันที");
                    }}
                    style={{
                      background: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      padding: "9px 16px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    ⚡ ซิงค์เข้า Discord
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Real-time Discord Message Preview */}
            <div style={{ position: "sticky", top: "80px" }}>
              <div style={{
                background: "#1e1f22",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "18px",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>👁️ ตัวอย่างหน้าจอใน Discord (Live Preview)</span>
                </div>

                {/* Simulated Discord Message */}
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#5865F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    flexShrink: 0
                  }}>
                    BOT
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.88rem" }}>YMM-TICKET</span>
                      <span style={{ background: "#5865F2", color: "#fff", fontSize: "0.6rem", padding: "1px 4px", borderRadius: "3px", fontWeight: 700 }}>
                        BOT
                      </span>
                      <span style={{ color: "#72767d", fontSize: "0.68rem" }}>วันนี้ เวลา 12:00</span>
                    </div>

                    {/* The Live Embed */}
                    <div style={{
                      marginTop: "6px",
                      background: "#2b2d31",
                      borderLeft: `4px solid ${config.embed_customization.panel_color || "#5865F2"}`,
                      borderRadius: "4px",
                      padding: "12px 14px",
                      width: "100%",
                      boxSizing: "border-box"
                    }}>
                      <b style={{ color: "#fff", fontSize: "0.92rem", display: "block", marginBottom: "4px" }}>
                        {config.embed_customization.panel_title || "🎫 ระบบ Support Ticket"}
                      </b>
                      <p style={{ color: "#dbdee1", fontSize: "0.82rem", margin: "0 0 10px", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                        {config.embed_customization.panel_description || "กดปุ่มด้านล่างเพื่อสร้าง Ticket ใหม่"}
                      </p>

                      {/* Categories fields */}
                      {config.embed_customization.categories && config.embed_customization.categories.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                          {config.embed_customization.categories.map((cat, idx) => (
                            <div key={idx} style={{ background: "#1e1f22", padding: "6px 8px", borderRadius: "4px", fontSize: "0.75rem", color: "#94a3b8" }}>
                              <span style={{ color: "#fff", fontWeight: 600 }}>{cat.name || "หัวข้อ"}</span>
                              {cat.value ? ` — ${cat.value}` : ""}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                        {config.embed_customization.footer_text || "Powered by YMM-TICKET"}
                      </div>
                    </div>

                    {/* Interactive Button Preview */}
                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        style={{
                          background: getDiscordButtonColor(config.embed_customization.button_style),
                          color: "#fff",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "4px",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "default"
                        }}
                      >
                        <span>{config.embed_customization.button_emoji || "🎫"}</span>
                        <span>{config.embed_customization.button_text || "สร้าง Ticket ใหม่"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ⚙️ SYSTEM & ROLES SETUP (Spacious Full Layout)                     */}
        {/* ========================================================================= */}
        {activeTab === "system" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {/* Channels & Logging */}
            <div className="dash-card">
              <div className="dash-card-header">
                <h3 className="dash-card-title">📁 ห้องและการบันทึกประวัติ</h3>
                <p className="dash-card-subtitle">กำหนดหมวดหมู่ห้องและห้องบันทึก Log สำหรับระบบ Ticket</p>
              </div>

              <div className="dash-field">
                <label className="dash-label">หมวดหมู่สำหรับสร้างห้อง Ticket (Ticket Category):</label>
                <select
                  value={config.ticket_config.category_id}
                  onChange={(e) => setConfig((prev) => ({
                    ...prev,
                    ticket_config: { ...prev.ticket_config, category_id: e.target.value }
                  }))}
                  className="dash-select"
                >
                  <option value="">-- เลือกหมวดหมู่ Discord --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>📁 {c.name}</option>
                  ))}
                </select>
                <small style={{ color: "#64748b", fontSize: "0.75rem" }}>ห้อง Ticket ที่ผู้ใช้เปิดจะถูกสร้างไว้ใต้หมวดหมู่นี้</small>
              </div>

              <div className="dash-field">
                <label className="dash-label">ห้องสำหรับบันทึก Log (Log Channel):</label>
                <select
                  value={config.ticket_config.log_channel_id}
                  onChange={(e) => setConfig((prev) => ({
                    ...prev,
                    ticket_config: { ...prev.ticket_config, log_channel_id: e.target.value }
                  }))}
                  className="dash-select"
                >
                  <option value="">-- เลือกห้องบันทึกประวัติ --</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
                <small style={{ color: "#64748b", fontSize: "0.75rem" }}>การเปิด, รับเคส, และปิด Ticket จะถูกส่งข้อความมายังห้องนี้</small>
              </div>
            </div>

            {/* Roles & Staff */}
            <div className="dash-card">
              <div className="dash-card-header">
                <h3 className="dash-card-title">🛡️ ยศและทีมงานดูแล Ticket</h3>
                <p className="dash-card-subtitle">กำหนดสิทธิ์ทีมงานที่สามารถมองเห็นและจัดการ Ticket ได้</p>
              </div>

              <div className="dash-field">
                <label className="dash-label">ยศทีมงาน Support (Staff Roles):</label>
                <div style={{
                  maxHeight: "160px",
                  overflowY: "auto",
                  background: "#090e1b",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "8px"
                }}>
                  {roles.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: "0.8rem", padding: "8px" }}>ไม่พบรายการยศในเซิร์ฟเวอร์</div>
                  ) : (
                    roles.map((r) => {
                      const isChecked = config.ticket_config.staff_role_ids?.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            background: isChecked ? "rgba(59, 130, 246, 0.12)" : "transparent",
                            marginBottom: "2px"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const cur = config.ticket_config.staff_role_ids || [];
                              const next = e.target.checked ? [...cur, r.id] : cur.filter((id) => id !== r.id);
                              setConfig((prev) => ({
                                ...prev,
                                ticket_config: { ...prev.ticket_config, staff_role_ids: next }
                              }));
                            }}
                          />
                          <span style={{ fontSize: "0.82rem", color: isChecked ? "#fff" : "#cbd5e1" }}>
                            {r.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="dash-field">
                <label className="dash-label">ยศหัวหน้าทีมงาน / Supervisor (รับแจ้งเตือน SLA เกินกำหนด):</label>
                <select
                  value={config.ticket_config.supervisor_role_id || ""}
                  onChange={(e) => setConfig((prev) => ({
                    ...prev,
                    ticket_config: { ...prev.ticket_config, supervisor_role_id: e.target.value || null }
                  }))}
                  className="dash-select"
                >
                  <option value="">-- ไม่ระบุยศหัวหน้า --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>👑 {r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* SLA & Ticket Lifecycle */}
            <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
              <div className="dash-card-header">
                <h3 className="dash-card-title">⏱️ กำหนดเวลาและข้อตกลงบริการ (SLA & Lifecycle)</h3>
                <p className="dash-card-subtitle">ตั้งค่าเวลาตอบกลับเคสและปิด Ticket อัตโนมัติ</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                <div className="dash-field">
                  <label className="dash-label">เป้าหมายเวลาตอบกลับครั้งแรก (SLA Deadline):</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      className="dash-input"
                      value={config.ticket_config.sla_minutes}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ticket_config: { ...prev.ticket_config, sla_minutes: parseInt(e.target.value) || 30 }
                      }))}
                      style={{ width: "120px" }}
                    />
                    <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>นาที</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setConfig((prev) => ({
                          ...prev,
                          ticket_config: { ...prev.ticket_config, sla_minutes: m }
                        }))}
                        style={{
                          background: config.ticket_config.sla_minutes === m ? "#3b82f6" : "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          fontSize: "0.75rem",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        {m} นาที
                      </button>
                    ))}
                  </div>
                </div>

                <div className="dash-field">
                  <label className="dash-label">ปิดเคสอัตโนมัติหากไม่มีการสนทนา (Auto-Close):</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      className="dash-input"
                      value={config.ticket_config.auto_close_hours}
                      onChange={(e) => setConfig((prev) => ({
                        ...prev,
                        ticket_config: { ...prev.ticket_config, auto_close_hours: parseInt(e.target.value) || 48 }
                      }))}
                      style={{ width: "120px" }}
                    />
                    <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>ชั่วโมง</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    {[24, 48, 72].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setConfig((prev) => ({
                          ...prev,
                          ticket_config: { ...prev.ticket_config, auto_close_hours: h }
                        }))}
                        style={{
                          background: config.ticket_config.auto_close_hours === h ? "#3b82f6" : "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          fontSize: "0.75rem",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        {h} ชั่วโมง
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: 🤖 AI ASSISTANT & KNOWLEDGE CHANNELS (Spacious Full Layout)        */}
        {/* ========================================================================= */}
        {activeTab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Card 1: AI Provider & BYOK */}
            <div className="dash-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 className="dash-card-title">🤖 ตั้งค่าผู้ช่วย AI (Bring Your Own Key)</h3>
                  <p className="dash-card-subtitle">AI จะคอยช่วยตอบคำถามลูกค้าใน Ticket อัตโนมัติจนกว่าทีมงานจะกดรับเคส (Claim)</p>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={config.ai_config.is_active}
                    onChange={(e) => setConfig((prev) => ({
                      ...prev,
                      ai_config: { ...prev.ai_config, is_active: e.target.checked }
                    }))}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <b style={{ color: config.ai_config.is_active ? "#34d399" : "#94a3b8", fontSize: "0.85rem" }}>
                    {config.ai_config.is_active ? "เปิดใช้งาน AI" : "ปิดใช้งาน AI"}
                  </b>
                </label>
              </div>

              {/* Provider Selection */}
              <div className="dash-field">
                <label className="dash-label">เลือกผู้ให้บริการ AI (Provider):</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                  {[
                    { id: "gemini", name: "Google Gemini", desc: "แนะนำ: ฉลาด รวดเร็ว และรองรับ Multimodal Vision" },
                    { id: "openai", name: "OpenAI", desc: "GPT-4o / GPT-4o-mini" },
                    { id: "claude", name: "Anthropic Claude", desc: "Claude 3.5 Sonnet" },
                  ].map((p) => {
                    const isChosen = config.ai_config.provider === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setConfig((prev) => ({
                          ...prev,
                          ai_config: {
                            ...prev.ai_config,
                            provider: p.id as any,
                            model: p.id === "gemini" ? "gemini-3.5-flash" : p.id === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20241022"
                          }
                        }))}
                        style={{
                          background: isChosen ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          border: isChosen ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "10px",
                          padding: "12px 14px",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <b style={{ color: isChosen ? "#fff" : "#cbd5e1", fontSize: "0.88rem", display: "block" }}>{p.name}</b>
                        <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "4px 0 0", lineHeight: 1.4 }}>{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Model Selection */}
              <div className="dash-field">
                <label className="dash-label">ชื่อโมเดล (Model Name):</label>
                <input
                  type="text"
                  className="dash-input"
                  value={config.ai_config.model}
                  onChange={(e) => setConfig((prev) => ({
                    ...prev,
                    ai_config: { ...prev.ai_config, model: e.target.value }
                  }))}
                  placeholder="เช่น gemini-3.5-flash หรือ gpt-4o-mini"
                />
                <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                  {["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gpt-4o-mini"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConfig((prev) => ({
                        ...prev,
                        ai_config: { ...prev.ai_config, model: m }
                      }))}
                      style={{
                        background: config.ai_config.model === m ? "#3b82f6" : "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#fff",
                        fontSize: "0.75rem",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        cursor: "pointer"
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div className="dash-field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label className="dash-label" style={{ marginBottom: 0 }}>API Key ของคุณ:</label>
                    {config.ai_config.has_api_key && (
                      <span style={{
                        fontSize: "0.72rem",
                        color: "#10b981",
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        ● บันทึกแล้วและพร้อมใช้งาน
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{ background: "none", border: "none", color: "#60a5fa", fontSize: "0.75rem", cursor: "pointer" }}
                  >
                    {showApiKey ? "ซ่อน Key" : "แสดง Key"}
                  </button>
                </div>
                <input
                  type={showApiKey ? "text" : "password"}
                  className="dash-input"
                  value={config.ai_config.api_key || ""}
                  onChange={(e) => {
                    if (apiKeyStatus !== "idle") {
                      setApiKeyStatus("idle");
                      setApiKeyMessage("");
                    }
                    setConfig((prev) => ({
                      ...prev,
                      ai_config: { ...prev.ai_config, api_key: e.target.value }
                    }));
                  }}
                  placeholder={config.ai_config.has_api_key ? "กรอกเพื่อเปลี่ยน API Key ใหม่ (เว้นว่างไว้เพื่อใช้ Key เดิม)" : "วาง API Key (เช่น sk-... หรือ AIza...)"}
                />

                {/* Inline Validation Status Message */}
                {apiKeyStatus === "validating" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#60a5fa", fontSize: "0.8rem", marginTop: "6px" }}>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>🔄</span>
                    <span>กำลังตรวจสอบ API Key...</span>
                  </div>
                )}
                {apiKeyStatus === "success" && (
                  <div style={{ color: "#10b981", fontSize: "0.8rem", marginTop: "6px", fontWeight: 500 }}>
                    {apiKeyMessage || "✅ ตรวจสอบสำเร็จ บันทึกเรียบร้อย"}
                  </div>
                )}
                {apiKeyStatus === "error" && (
                  <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "6px", fontWeight: 500 }}>
                    ⚠️ {apiKeyMessage}
                  </div>
                )}

                <small style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                  🔐 ระบบเข้ารหัสความปลอดภัย AES-256-GCM ผูกกับ Server ID เพื่อความปลอดภัยสูงสุด
                </small>
              </div>
            </div>

            {/* Card 2: Knowledge Source Channels (UID Reader) */}
            <div className="dash-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 className="dash-card-title">💬 กำหนดเลขห้อง (UID) ให้ AI อ่านเนื้อหาและรูปภาพ</h3>
                  <p className="dash-card-subtitle">
                    ระบุ UID ห้องประกาศ กฎ หรือบัญชีธนาคาร เพื่อให้ AI ดึงข้อมูลและรูปภาพมาตอบคำถามลูกค้าใน Ticket ได้อย่างแม่นยำ
                  </p>
                </div>

                {/* Clear all channels */}
                {((config.ai_config.channel_ids && config.ai_config.channel_ids.length > 0) || config.ai_config.channel_id) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("คุณต้องการลบห้อง AI ทั้งหมดออกจากรายการใช่หรือไม่?")) {
                        setConfig((prev) => ({
                          ...prev,
                          ai_config: { ...prev.ai_config, channel_id: "", channel_ids: [] }
                        }));
                      }
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    ✕ ลบห้องทั้งหมด
                  </button>
                )}
              </div>

              {/* Add Room UID Row */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) auto",
                gap: "10px",
                alignItems: "end",
                marginBottom: "16px"
              }}>
                <div>
                  <span className="dash-label" style={{ display: "block", marginBottom: "4px" }}>
                    กรอก UID เลขห้อง (Channel ID):
                  </span>
                  <input
                    type="text"
                    className="dash-input"
                    value={inputChannelUid}
                    onChange={(e) => setInputChannelUid(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const matches = inputChannelUid.match(/\d{17,21}/g) || (inputChannelUid.trim() ? [inputChannelUid.trim().replace(/[<#>]/g, "")] : []);
                        if (matches.length === 0) return;
                        if (channels.length > 0) {
                          const foreign = matches.filter(id => !channels.some((c: any) => c.id === id));
                          if (foreign.length > 0) {
                            const ok = confirm(`⚠️ UID (${foreign.join(", ")}) ไม่พบในเซิร์ฟเวอร์ "${config.guild_name}"!\n\nหากเป็นห้องจากเซิร์ฟเวอร์อื่น บอทจะไม่อ่านข้อมูลเพื่อป้องกันการรั่วไหลข้ามเซิร์ฟเวอร์ คุณแน่ใจหรือไม่ว่าต้องการเพิ่ม?`);
                            if (!ok) return;
                          }
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
                      }
                    }}
                    placeholder="เช่น 1546823091848614001"
                  />
                </div>

                {channels && channels.length > 0 && (
                  <div>
                    <span className="dash-label" style={{ display: "block", marginBottom: "4px" }}>
                      หรือเลือกห้องจาก Discord:
                    </span>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setInputChannelUid(e.target.value);
                        }
                      }}
                      className="dash-select"
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
                    if (channels.length > 0) {
                      const foreign = matches.filter(id => !channels.some((c: any) => c.id === id));
                      if (foreign.length > 0) {
                        const ok = confirm(`⚠️ UID (${foreign.join(", ")}) ไม่พบในเซิร์ฟเวอร์ "${config.guild_name}"!\n\nหากเป็นห้องจากเซิร์ฟเวอร์อื่น บอทจะไม่อ่านข้อมูลเพื่อป้องกันการรั่วไหลข้ามเซิร์ฟเวอร์ คุณแน่ใจหรือไม่ว่าต้องการเพิ่ม?`);
                        if (!ok) return;
                      }
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
                    padding: "10px 18px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  ➕ เพิ่มห้อง
                </button>
              </div>

              {/* List of Configured Channels */}
              <div style={{ marginTop: "14px" }}>
                {(() => {
                  const channelList = (config.ai_config.channel_ids && config.ai_config.channel_ids.length > 0)
                    ? config.ai_config.channel_ids
                    : (config.ai_config.channel_id ? [config.ai_config.channel_id] : []);
                  const orphanList = channels.length > 0
                    ? channelList.filter(id => !channels.some((c: any) => c.id === id))
                    : [];

                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                        <span className="dash-label" style={{ display: "block" }}>
                          📋 รายการห้องที่ AI จะเข้าไปอ่านข้อมูลอ้างอิง ({channelList.length} ห้อง):
                        </span>
                        {orphanList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const cleanList = channelList.filter(id => channels.some((c: any) => c.id === id));
                              setConfig((prev) => ({
                                ...prev,
                                ai_config: {
                                  ...prev.ai_config,
                                  channel_ids: cleanList,
                                  channel_id: cleanList[0] || "",
                                }
                              }));
                            }}
                            style={{
                              background: "rgba(239, 68, 68, 0.15)",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              color: "#f87171",
                              borderRadius: "6px",
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            🧹 ล้าง {orphanList.length} ห้องที่อยู่นอกเซิร์ฟเวอร์นี้
                          </button>
                        )}
                      </div>

                      {orphanList.length > 0 && (
                        <div style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          marginBottom: "12px",
                          fontSize: "0.78rem",
                          color: "#fca5a5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px"
                        }}>
                          <span>⚠️ ตรวจพบ {orphanList.length} ห้องที่มาจากเซิร์ฟเวอร์อื่นหรือถูกลบไปแล้ว บอทจะไม่นำมาอ่านข้อมูลร่วมกัน กรุณากดปุ่ม <b>ล้างห้องที่อยู่นอกเซิร์ฟเวอร์</b> ด้านบนเพื่อทำความสะอาด</span>
                        </div>
                      )}

                      {channelList.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "18px", color: "#64748b", fontSize: "0.82rem", border: "1px dashed rgba(255, 255, 255, 0.08)", borderRadius: "8px" }}>
                          ยังไม่ได้ระบุห้อง AI (AI จะตอบเฉพาะข้อมูลที่มีใน Knowledge Base)
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                          {channelList.map((cId) => {
                            const found = channels.find((c: any) => c.id === cId);
                            const isOrphan = channels.length > 0 && !found;
                            return (
                              <div
                                key={cId}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  background: isOrphan ? "rgba(239, 68, 68, 0.06)" : "rgba(255, 255, 255, 0.03)",
                                  border: isOrphan ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                                  borderRadius: "8px",
                                  padding: "10px 12px"
                                }}
                              >
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <b style={{ color: isOrphan ? "#f87171" : "#fff", fontSize: "0.85rem" }}>
                                      {found ? `#${found.name}` : "ห้อง Discord"}
                                    </b>
                                    {isOrphan && (
                                      <span style={{
                                        fontSize: "0.65rem",
                                        background: "rgba(239, 68, 68, 0.2)",
                                        color: "#f87171",
                                        padding: "1px 5px",
                                        borderRadius: "4px",
                                        fontWeight: 600
                                      }}>
                                        นอกเซิร์ฟเวอร์
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontFamily: "monospace" }}>
                                    UID: {cId}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextList = channelList.filter((id) => id !== cId);
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
                                    background: "rgba(239, 68, 68, 0.12)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    color: "#f87171",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "0.72rem",
                                    cursor: "pointer"
                                  }}
                                >
                                  ✕ ลบ
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: 📚 KNOWLEDGE BASE (Spacious Full Layout)                           */}
        {/* ========================================================================= */}
        {activeTab === "kb" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Add Article Form */}
            <div className="dash-card">
              <div className="dash-card-header">
                <h3 className="dash-card-title">➕ เพิ่มบทความใหม่ลงคลังความรู้</h3>
                <p className="dash-card-subtitle">AI จะนำบทความเหล่านี้ไปใช้วิเคราะห์และตอบคำถามลูกค้า</p>
              </div>

              <form onSubmit={handleAddKb}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                  <div className="dash-field">
                    <label className="dash-label">หัวข้อบทความ (Title):</label>
                    <input
                      type="text"
                      className="dash-input"
                      value={newKbTitle}
                      onChange={(e) => setNewKbTitle(e.target.value)}
                      placeholder="เช่น วิธีชำระเงิน หรือ นโยบายการคืนเงิน"
                      required
                    />
                  </div>
                  <div className="dash-field">
                    <label className="dash-label">แท็กคีย์เวิร์ด (คั่นด้วยจุลภาค):</label>
                    <input
                      type="text"
                      className="dash-input"
                      value={newKbTags}
                      onChange={(e) => setNewKbTags(e.target.value)}
                      placeholder="เช่น โอนเงิน, กสิกร, บัญชี, คืนเงิน"
                    />
                  </div>
                </div>

                <div className="dash-field">
                  <label className="dash-label">เนื้อหาบทความ (Content):</label>
                  <textarea
                    rows={4}
                    className="dash-textarea"
                    value={newKbContent}
                    onChange={(e) => setNewKbContent(e.target.value)}
                    placeholder="พิมพ์รายละเอียดคำแนะนำ นโยบาย หรือขั้นตอนที่ต้องการให้ AI ตอบ..."
                    required
                  />
                </div>

                <div className="dash-field">
                  <label className="dash-label">ลิงก์รูปภาพประกอบ (ถ้ามี):</label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      className="dash-input"
                      value={newKbImageUrl}
                      onChange={(e) => setNewKbImageUrl(e.target.value)}
                      placeholder="https://... หรืออัปโหลดจากเครื่อง"
                      style={{ flex: 1, minWidth: "200px" }}
                    />
                    <label style={{
                      background: uploadingImage ? "#475569" : "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "8px",
                      padding: "9px 14px",
                      cursor: uploadingImage ? "not-allowed" : "pointer",
                      fontSize: "0.82rem",
                      color: "#fff",
                      whiteSpace: "nowrap"
                    }}>
                      {uploadingImage ? "⏳ กำลังอัปโหลด..." : "📁 เลือกไฟล์รูป"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        disabled={uploadingImage}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                  {uploadError && <small style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px" }}>{uploadError}</small>}
                </div>

                <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={addingKb}
                    style={{
                      background: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      padding: "9px 20px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: addingKb ? "not-allowed" : "pointer"
                    }}
                  >
                    {addingKb ? "กำลังบันทึก..." : "➕ บันทึกบทความ"}
                  </button>
                </div>
              </form>
            </div>

            {/* List of Existing Articles */}
            <div>
              <h4 style={{ fontSize: "0.95rem", color: "#cbd5e1", margin: "0 0 12px", fontWeight: 700 }}>
                รายการบทความในคลังความรู้ ({kbArticles.length})
              </h4>
              {kbArticles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", background: "#0d1527", borderRadius: "12px", color: "#64748b", border: "1px dashed rgba(255, 255, 255, 0.08)" }}>
                  ยังไม่มีบทความในคลังความรู้ สามารถเพิ่มบทความแรกของคุณด้านบนได้ทันที
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
                  {kbArticles.map((art) => (
                    <div
                      key={art.id}
                      className="dash-card"
                      style={{ padding: "16px" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <b style={{ fontSize: "0.92rem", color: "#fff" }}>{art.title}</b>
                        <button
                          onClick={() => handleDeleteKb(art.id, art.title)}
                          style={{
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#f87171",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.72rem",
                            cursor: "pointer",
                            fontWeight: 600
                          }}
                        >
                          ลบ
                        </button>
                      </div>

                      <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "8px 0", lineHeight: 1.5, maxHeight: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {art.content}
                      </p>

                      {art.image_url && (
                        <div style={{ marginTop: "4px" }}>
                          <a href={art.image_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#60a5fa", textDecoration: "none" }}>
                            🖼️ ดูรูปภาพประกอบ ↗
                          </a>
                        </div>
                      )}

                      {art.tags && art.tags.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
                          {art.tags.map(t => (
                            <span key={t} style={{ fontSize: "0.68rem", color: "#94a3b8", background: "rgba(255, 255, 255, 0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: 📊 RECENT TICKETS (Responsive Table Desktop / Cards Mobile)         */}
        {/* ========================================================================= */}
        {activeTab === "tickets" && (
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">📊 รายการ Ticket ล่าสุดในเซิร์ฟเวอร์ ({recentTickets.length})</h3>
              <p className="dash-card-subtitle">ดูประวัติและสถานะของ Ticket ที่เปิดในเซิร์ฟเวอร์นี้</p>
            </div>

            {recentTickets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                ยังไม่มีรายการ Ticket ในเซิร์ฟเวอร์นี้
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8" }}>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>#</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>หัวข้อ</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>ผู้สร้าง</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>สถานะ</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>CSAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: "#60a5fa" }}>
                          #{t.ticket_number}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#fff" }}>
                          {t.subject}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#94a3b8" }}>
                          {t.author_tag}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            background: t.status === "closed" ? "rgba(100, 116, 139, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: t.status === "closed" ? "#94a3b8" : "#34d399"
                          }}>
                            {t.status === "closed" ? "ปิดแล้ว" : "เปิดอยู่"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#fbbf24" }}>
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
      </main>
    </div>
  );
}
