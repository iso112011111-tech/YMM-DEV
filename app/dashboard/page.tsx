"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "@/app/img/logo.png";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

interface RoleMapping {
  emoji: string;
  roleId: string;
  roleName: string;
}

interface DashboardConfig {
  guild_id: string;
  server_name: string;
  theme_color: string;
  system_type: "both" | "emoji" | "form";
  log_channel_id: string;
  panel_channel_id?: string;
  welcome_enabled: boolean;
  welcome_title: string;
  welcome_message: string;
  form_title: string;
  form_role_id: string;
  form_questions: string[];
  reaction_roles: RoleMapping[];
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
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

const DEFAULT_CONFIG: DashboardConfig = {
  guild_id: "1543099793226600528",
  server_name: "YMM DEV",
  theme_color: "#8B5CF6",
  system_type: "both",
  log_channel_id: "1546477565785546813",
  panel_channel_id: "1546477485904892004",
  welcome_enabled: true,
  welcome_title: "🎉 ยินดีต้อนรับสู่ {server}!",
  welcome_message: "สวัสดี {user}\n\nคุณได้รับยศ 👑 {role} เรียบร้อยแล้ว\nขอให้สนุกกับการใช้งาน Server ของเรานะครับ 💜",
  form_title: "แบบฟอร์มกรอกข้อมูลเพื่อรับยศ",
  form_role_id: "1546299207269224521",
  form_questions: ["ชื่อ-นามสกุล หรือ ชื่อเล่น", "อายุ", "เหตุผลที่เข้าร่วมเซิร์ฟเวอร์"],
  reaction_roles: [
    { emoji: "👑", roleId: "1546299207269224521", roleName: "MEMBERS" },
    { emoji: "⭐", roleId: "1546299334537256960", roleName: "ลูกค้า" }
  ]
};

const PRESET_COLORS = [
  { name: "Neon Purple", hex: "#8B5CF6" },
  { name: "Neon Blue", hex: "#3B82F6" },
  { name: "Cyber Cyan", hex: "#06B6D4" },
  { name: "Emerald Green", hex: "#10B981" },
  { name: "Neon Pink", hex: "#EC4899" },
  { name: "Amber Gold", hex: "#F59E0B" }
];

export default function DashboardPage() {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"appearance" | "system" | "welcome" | "form" | "roles">("appearance");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [newEmoji, setNewEmoji] = useState("👑");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [customRoleId, setCustomRoleId] = useState("");
  const [previewTab, setPreviewTab] = useState<"emoji_panel" | "form_panel" | "welcome_dm">("emoji_panel");

  // Discord Profile & Live Bot Data
  const [profile, setProfile] = useState<DiscordProfile | null>(null);
  const [botGuilds, setBotGuilds] = useState<DiscordGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [isCustomServer, setIsCustomServer] = useState(false);

  // 1. Fetch User Profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { profile: DiscordProfile | null }) => {
        setProfile(data.profile);
      })
      .catch(() => setProfile(null));
  }, []);

  // 2. Fetch Guilds that the Bot is currently in
  useEffect(() => {
    fetch("/api/discord/guilds")
      .then((res) => res.json())
      .then((data: { guilds?: DiscordGuild[] }) => {
        if (data.guilds && data.guilds.length > 0) {
          setBotGuilds(data.guilds);
          // If current guild is default_server, auto switch to the real bot guild
          setConfig((prev) => {
            if (prev.guild_id === "default_server" || !prev.guild_id) {
              const firstGuild = data.guilds![0];
              return {
                ...prev,
                guild_id: firstGuild.id,
                server_name: firstGuild.name
              };
            }
            return prev;
          });
        }
      })
      .catch((err) => console.warn("Could not load bot guilds:", err));
  }, []);

  // 3. Fetch Channels & Roles whenever selected guild_id changes
  useEffect(() => {
    if (!config.guild_id || config.guild_id === "default_server") return;

    fetch(`/api/discord/guilds?guildId=${config.guild_id}`)
      .then((res) => res.json())
      .then((data: { channels?: DiscordChannel[]; roles?: DiscordRole[] }) => {
        if (data.channels) setChannels(data.channels);
        if (data.roles) {
          setRoles(data.roles);
          if (data.roles.length > 0 && !selectedRoleId) {
            setSelectedRoleId(data.roles[0].id);
          }
        }
      })
      .catch((err) => console.warn("Could not load channels/roles:", err));
  }, [config.guild_id, selectedRoleId]);

  // 4. Real-time Firebase Firestore Sync for current guild
  useEffect(() => {
    if (!config.guild_id || config.guild_id === "default_server") return;
    const docRef = doc(db, "guilds", config.guild_id);

    // Initial fetch
    getDoc(docRef).then((snapshot) => {
      if (snapshot.exists()) {
        setConfig((prev) => ({ ...prev, ...(snapshot.data() as Partial<DashboardConfig>) }));
      }
    }).catch((err) => {
      console.warn("Firestore fetch notice:", err);
    });

    // Real-time sync listener
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setConfig((prev) => ({ ...prev, ...(snapshot.data() as Partial<DashboardConfig>) }));
      }
    });

    return () => unsubscribe();
  }, [config.guild_id]);

  // Handle Save to Firebase Firestore
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const docRef = doc(db, "guilds", config.guild_id);
      await setDoc(docRef, {
        ...config,
        updated_at: new Date().toISOString()
      }, { merge: true });

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (error) {
      console.error("Failed to save to Firestore:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Add Role Mapping (Dropdown role or Custom role)
  const addRoleMapping = () => {
    let roleNameToAdd = "";
    let roleIdToAdd = "";

    if (selectedRoleId && selectedRoleId !== "custom") {
      const found = roles.find((r) => r.id === selectedRoleId);
      if (found) {
        roleNameToAdd = found.name;
        roleIdToAdd = found.id;
      }
    } else {
      roleNameToAdd = customRoleName.trim();
      roleIdToAdd = customRoleId.trim();
    }

    if (!roleNameToAdd || !roleIdToAdd) return;

    setConfig((prev) => ({
      ...prev,
      reaction_roles: [
        ...prev.reaction_roles,
        { emoji: newEmoji, roleName: roleNameToAdd, roleId: roleIdToAdd }
      ]
    }));

    setCustomRoleName("");
    setCustomRoleId("");
  };

  const removeRoleMapping = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      reaction_roles: prev.reaction_roles.filter((_, i) => i !== index)
    }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07111f",
      color: "#eef5ff",
      fontFamily: "var(--font-manrope), sans-serif",
      paddingBottom: "80px"
    }}>
      {/* Top Header Navbar */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(9, 21, 37, 0.95)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(72, 139, 222, 0.2)",
        padding: "12px 24px"
      }}>
        <div style={{
          maxWidth: "1300px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          {/* Brand Link */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}>
              <Image src={logo} alt="YMM-DEV" width={36} height={36} style={{ borderRadius: "8px" }} />
              <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "0.04em" }}>YMM-DEV</span>
            </Link>
            <span style={{ color: "#475569" }}>/</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))",
                border: "1px solid rgba(139, 92, 246, 0.4)",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.8rem",
                color: "#c4b5fd",
                fontWeight: 600
              }}>
                👑 BOT-ROLE
              </span>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>Web Dashboard</span>
            </div>
          </div>

          {/* Right Actions: Real Server Selector & Profile & Save Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Live Server Selector Dropdown */}
            {botGuilds.length > 0 && !isCustomServer ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(13, 26, 45, 0.85)",
                padding: "6px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(139, 92, 246, 0.4)",
                boxShadow: "0 0 10px rgba(139, 92, 246, 0.15)"
              }}>
                <span style={{ fontSize: "0.8rem", color: "#c4b5fd", fontWeight: 600 }}>🏰 เซิร์ฟเวอร์:</span>
                <select
                  value={config.guild_id}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    if (selectedVal === "custom") {
                      setIsCustomServer(true);
                    } else {
                      const selected = botGuilds.find((g) => g.id === selectedVal);
                      setConfig((prev) => ({
                        ...prev,
                        guild_id: selectedVal,
                        server_name: selected ? selected.name : prev.server_name
                      }));
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {botGuilds.map((g) => (
                    <option key={g.id} value={g.id} style={{ background: "#0d1a2d", color: "#fff" }}>
                      🟢 {g.name}
                    </option>
                  ))}
                  <option value="custom" style={{ background: "#0d1a2d", color: "#c4b5fd" }}>
                    ✏️ ระบุ Server ID อื่นเอง...
                  </option>
                </select>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(13, 26, 45, 0.8)", padding: "6px 12px", borderRadius: "10px", border: "1px solid rgba(72, 139, 222, 0.2)" }}>
                <span style={{ fontSize: "0.8rem", color: "#8ea4c3" }}>Server ID:</span>
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
                    style={{ background: "transparent", border: "none", color: "#8ea4c3", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
                  >
                    กลับไปเลือกรายการ
                  </button>
                )}
              </div>
            )}

            {/* Discord User Profile Badge or Login Button */}
            {profile ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(13, 26, 45, 0.8)",
                padding: "4px 12px",
                borderRadius: "20px",
                border: "1px solid rgba(72, 139, 222, 0.2)"
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
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>
                  {profile.globalName || profile.username}
                </span>
              </div>
            ) : (
              <a
                href="/api/auth/discord?redirect=/dashboard"
                style={{
                  background: "#5865F2",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>🎮</span> เข้าสู่ระบบ Discord
              </a>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving 
                  ? "#475569" 
                  : `linear-gradient(135deg, ${config.theme_color}, #2563EB)`,
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: `0 4px 15px ${config.theme_color}44`,
                transition: "all 0.2s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกการตั้งค่า"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{
        maxWidth: "1300px",
        margin: "24px auto",
        padding: "0 24px",
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: "28px",
        alignItems: "start"
      }}>
        {/* Left Column: Configuration Forms */}
        <div>
          {/* Notification Toast */}
          {saveStatus === "success" && (
            <div style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10B981",
              color: "#34D399",
              padding: "12px 16px",
              borderRadius: "12px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontWeight: 600,
              fontSize: "0.9rem"
            }}>
              ✅ บันทึกข้อมูลขึ้น Firebase Firestore สำเร็จ! บอทจะ Sync ข้อมูลนี้ไปใช้งานทันที
            </div>
          )}

          {saveStatus === "error" && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #EF4444",
              color: "#F87171",
              padding: "12px 16px",
              borderRadius: "12px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontWeight: 600,
              fontSize: "0.9rem"
            }}>
              ❌ เกิดข้อผิดพลาดในการบันทึก กรุณาตรวจสอบการตั้งค่า Firebase
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{
            display: "flex",
            gap: "8px",
            background: "rgba(13, 26, 45, 0.9)",
            padding: "6px",
            borderRadius: "14px",
            border: "1px solid rgba(72, 139, 222, 0.2)",
            marginBottom: "24px",
            overflowX: "auto"
          }}>
            {[
              { id: "appearance", label: "🎨 ธีมและสี", desc: "Theme & Color" },
              { id: "system", label: "⚡ ระบบรับยศและห้อง", desc: "Channels & System" },
              { id: "welcome", label: "💌 ข้อความต้อนรับ", desc: "Welcome DM" },
              { id: "form", label: "📋 แบบฟอร์ม", desc: "Form Setup" },
              { id: "roles", label: "👑 ผูก Emoji / Role", desc: "Role Mapping" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeTab === tab.id 
                    ? `linear-gradient(135deg, ${config.theme_color}33, rgba(45, 140, 255, 0.15))`
                    : "transparent",
                  color: activeTab === tab.id ? "#fff" : "#8ea4c3",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                  borderBottom: activeTab === tab.id ? `2px solid ${config.theme_color}` : "2px solid transparent"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Appearance & Theme Color */}
          {activeTab === "appearance" && (
            <div style={{
              background: "rgba(13, 26, 45, 0.75)",
              backdropFilter: "blur(20px)",
              borderRadius: "18px",
              padding: "24px",
              border: "1px solid rgba(72, 139, 222, 0.25)"
            }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>🎨 ตั้งค่าธีมสีและชื่อเซิร์ฟเวอร์</h2>
              <p style={{ color: "#8ea4c3", fontSize: "0.85rem", marginBottom: "20px" }}>
                สีและชื่อเซิร์ฟเวอร์นี้จะถูกนำไปใช้ใน Discord Embed ทุกชิ้นที่บอทส่ง
              </p>

              {/* Server Display Name */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  ชื่อเซิร์ฟเวอร์ (Server Name)
                </label>
                <input
                  type="text"
                  value={config.server_name}
                  onChange={(e) => setConfig({ ...config, server_name: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(7, 17, 31, 0.8)",
                    border: "1px solid rgba(72, 139, 222, 0.3)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    outline: "none"
                  }}
                  placeholder="เช่น YMM DEV..."
                />
              </div>

              {/* Theme Color Picker */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  สีธีมหลักของบอท (Primary Embed Color)
                </label>

                {/* Preset Palettes */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setConfig({ ...config, theme_color: preset.hex })}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: config.theme_color === preset.hex ? "rgba(255, 255, 255, 0.1)" : "rgba(7, 17, 31, 0.6)",
                        border: config.theme_color === preset.hex ? `2px solid ${preset.hex}` : "1px solid rgba(72, 139, 222, 0.2)",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: 600
                      }}
                    >
                      <span style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: preset.hex,
                        boxShadow: `0 0 8px ${preset.hex}`
                      }} />
                      {preset.name}
                    </button>
                  ))}
                </div>

                {/* Custom Hex input */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="color"
                    value={config.theme_color}
                    onChange={(e) => setConfig({ ...config, theme_color: e.target.value })}
                    style={{
                      width: "42px",
                      height: "42px",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: "transparent"
                    }}
                  />
                  <input
                    type="text"
                    value={config.theme_color}
                    onChange={(e) => setConfig({ ...config, theme_color: e.target.value })}
                    style={{
                      flex: 1,
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                    placeholder="#8B5CF6"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: System Mode & Real Channels Selection */}
          {activeTab === "system" && (
            <div style={{
              background: "rgba(13, 26, 45, 0.75)",
              backdropFilter: "blur(20px)",
              borderRadius: "18px",
              padding: "24px",
              border: "1px solid rgba(72, 139, 222, 0.25)"
            }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>⚡ รูปแบบระบบและเลือกห้องสำหรับบอท</h2>
              <p style={{ color: "#8ea4c3", fontSize: "0.85rem", marginBottom: "20px" }}>
                เลือกระบบรับยศ และระบุห้องที่ต้องการให้บอทส่งข้อความ/บันทึก Log ในเซิร์ฟเวอร์
              </p>

              {/* Mode Select */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                {[
                  { type: "both", title: "เปิดทั้งสองระบบ", icon: "✨", desc: "Emoji & Form พร้อมกัน" },
                  { type: "emoji", title: "กด Emoji เท่านั้น", icon: "🏆", desc: "คลิก Emoji ได้รับยศทันที" },
                  { type: "form", title: "กรอกฟอร์มเท่านั้น", icon: "📋", desc: "กรอกข้อมูลยืนยันตัวตน" }
                ].map((mode) => (
                  <button
                    key={mode.type}
                    type="button"
                    onClick={() => setConfig({ ...config, system_type: mode.type as DashboardConfig["system_type"] })}
                    style={{
                      background: config.system_type === mode.type ? `linear-gradient(135deg, ${config.theme_color}22, rgba(45, 140, 255, 0.15))` : "rgba(7, 17, 31, 0.6)",
                      border: config.system_type === mode.type ? `2px solid ${config.theme_color}` : "1px solid rgba(72, 139, 222, 0.2)",
                      padding: "14px 12px",
                      borderRadius: "12px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#fff"
                    }}
                  >
                    <div style={{ fontSize: "1.6rem", marginBottom: "6px" }}>{mode.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{mode.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#8ea4c3", marginTop: "4px" }}>{mode.desc}</div>
                  </button>
                ))}
              </div>

              {/* Channel Selector for Role Panel */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  📍 ห้องสำหรับส่งแผงรับยศ (Role Panel Channel)
                </label>
                {channels.length > 0 ? (
                  <select
                    value={config.panel_channel_id || ""}
                    onChange={(e) => setConfig({ ...config, panel_channel_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                  >
                    <option value="" style={{ background: "#0d1a2d" }}>-- เลือกห้องข้อความในเซิร์ฟเวอร์ --</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id} style={{ background: "#0d1a2d" }}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.panel_channel_id || ""}
                    onChange={(e) => setConfig({ ...config, panel_channel_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                    placeholder="ระบุ Channel ID เช่น 1546477485904892004"
                  />
                )}
                <span style={{ fontSize: "0.75rem", color: "#8ea4c3", display: "block", marginTop: "4px" }}>
                  * ห้องที่บอทจะส่ง Embed แผงรับยศให้สมาชิกมากดรับ
                </span>
              </div>

              {/* Log Channel Selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  📢 ห้องสำหรับแจ้งเตือน Admin Log (Log Channel)
                </label>
                {channels.length > 0 ? (
                  <select
                    value={config.log_channel_id}
                    onChange={(e) => setConfig({ ...config, log_channel_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                  >
                    <option value="" style={{ background: "#0d1a2d" }}>-- เลือกห้องแจ้งเตือน Log --</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id} style={{ background: "#0d1a2d" }}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.log_channel_id}
                    onChange={(e) => setConfig({ ...config, log_channel_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                    placeholder="ระบุ Channel ID สำหรับ Log เช่น 1546477565785546813"
                  />
                )}
                <span style={{ fontSize: "0.75rem", color: "#8ea4c3", display: "block", marginTop: "4px" }}>
                  * บอทจะส่ง Embed แจ้งเตือนแอดมินทุกครั้งที่มีสมาชิกได้รับยศเข้ามาที่ห้องนี้
                </span>
              </div>
            </div>
          )}

          {/* Tab 3: Welcome DM Message */}
          {activeTab === "welcome" && (
            <div style={{
              background: "rgba(13, 26, 45, 0.75)",
              backdropFilter: "blur(20px)",
              borderRadius: "18px",
              padding: "24px",
              border: "1px solid rgba(72, 139, 222, 0.25)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>💌 ข้อความต้อนรับส่วนตัว (Welcome DM)</h2>
                  <p style={{ color: "#8ea4c3", fontSize: "0.85rem" }}>ส่งข้อความ Embed เข้ากล่องข้อความส่วนตัวของสมาชิกทันทีหลังได้รับยศ</p>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={config.welcome_enabled}
                    onChange={(e) => setConfig({ ...config, welcome_enabled: e.target.checked })}
                    style={{ width: "18px", height: "18px", accentColor: config.theme_color }}
                  />
                  เปิดใช้งาน DM
                </label>
              </div>

              {/* Welcome Title */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  หัวข้อข้อความ (Title)
                </label>
                <input
                  type="text"
                  value={config.welcome_title}
                  onChange={(e) => setConfig({ ...config, welcome_title: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(7, 17, 31, 0.8)",
                    border: "1px solid rgba(72, 139, 222, 0.3)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    outline: "none"
                  }}
                />
              </div>

              {/* Welcome Description */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  เนื้อหาข้อความ (Description)
                </label>
                <textarea
                  rows={5}
                  value={config.welcome_message}
                  onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(7, 17, 31, 0.8)",
                    border: "1px solid rgba(72, 139, 222, 0.3)",
                    color: "#fff",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>

              {/* Variables Helper */}
              <div style={{ background: "rgba(7, 17, 31, 0.6)", padding: "12px 16px", borderRadius: "10px", fontSize: "0.8rem", color: "#8ea4c3" }}>
                💡 <b>ตัวแปรที่ใช้งานได้:</b> <code style={{ color: "#c4b5fd" }}>&#123;user&#125;</code> = ชื่อสมาชิก, <code style={{ color: "#c4b5fd" }}>&#123;role&#125;</code> = ยศที่ได้รับ, <code style={{ color: "#c4b5fd" }}>&#123;server&#125;</code> = ชื่อเซิร์ฟเวอร์
              </div>
            </div>
          )}

          {/* Tab 4: Form Verification Setup */}
          {activeTab === "form" && (
            <div style={{
              background: "rgba(13, 26, 45, 0.75)",
              backdropFilter: "blur(20px)",
              borderRadius: "18px",
              padding: "24px",
              border: "1px solid rgba(72, 139, 222, 0.25)"
            }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>📋 ตั้งค่าแบบฟอร์มยืนยันตัวตน</h2>
              <p style={{ color: "#8ea4c3", fontSize: "0.85rem", marginBottom: "20px" }}>
                กำหนดหัวข้อฟอร์มและเลือก Role ที่จะแจกเมื่อสมาชิกส่งข้อมูลสำเร็จ
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  หัวข้อฟอร์ม (Form Title)
                </label>
                <input
                  type="text"
                  value={config.form_title}
                  onChange={(e) => setConfig({ ...config, form_title: e.target.value })}
                  style={{
                    width: "100%",
                    background: "rgba(7, 17, 31, 0.8)",
                    border: "1px solid rgba(72, 139, 222, 0.3)",
                    color: "#fff",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    outline: "none"
                  }}
                />
              </div>

              {/* Form Target Role Dropdown */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  🎯 Role ที่จะมอบให้เมื่อส่งฟอร์มสำเร็จ (Target Role)
                </label>
                {roles.length > 0 ? (
                  <select
                    value={config.form_role_id}
                    onChange={(e) => setConfig({ ...config, form_role_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id} style={{ background: "#0d1a2d" }}>
                        @{r.name} ({r.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.form_role_id}
                    onChange={(e) => setConfig({ ...config, form_role_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "rgba(7, 17, 31, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      outline: "none"
                    }}
                    placeholder="เช่น 1546299207269224521"
                  />
                )}
              </div>

              {/* Form Questions */}
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#c4b5fd", marginBottom: "8px" }}>
                  รายการช่องกรอกข้อมูลใน Modal
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {config.form_questions.map((q, idx) => (
                    <div key={idx} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(7, 17, 31, 0.6)",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(72, 139, 222, 0.2)"
                    }}>
                      <span style={{ color: "#8ea4c3", fontSize: "0.85rem", width: "24px" }}>#{idx + 1}</span>
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => {
                          const updated = [...config.form_questions];
                          updated[idx] = e.target.value;
                          setConfig({ ...config, form_questions: updated });
                        }}
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          color: "#fff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setConfig({
                            ...config,
                            form_questions: config.form_questions.filter((_, i) => i !== idx)
                          });
                        }}
                        style={{
                          background: "rgba(239, 68, 68, 0.2)",
                          border: "none",
                          color: "#F87171",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.75rem"
                        }}
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setConfig({ ...config, form_questions: [...config.form_questions, "คำถามใหม่..."] });
                    }}
                    style={{
                      background: "rgba(139, 92, 246, 0.15)",
                      border: "1px dashed rgba(139, 92, 246, 0.4)",
                      color: "#c4b5fd",
                      padding: "8px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginTop: "6px"
                    }}
                  >
                    + เพิ่มคำถาม
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Role & Emoji Mappings with Role Dropdown */}
          {activeTab === "roles" && (
            <div style={{
              background: "rgba(13, 26, 45, 0.75)",
              backdropFilter: "blur(20px)",
              borderRadius: "18px",
              padding: "24px",
              border: "1px solid rgba(72, 139, 222, 0.25)"
            }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>👑 ผูก Emoji กับ Role</h2>
              <p style={{ color: "#8ea4c3", fontSize: "0.85rem", marginBottom: "20px" }}>
                กำหนดว่าเมื่อสมาชิกกด Emoji แต่ละตัว จะได้รับยศอะไร โดยเลือก Role จากเซิร์ฟเวอร์ได้ทันที
              </p>

              {/* Add New Mapping Form */}
              <div style={{
                background: "rgba(7, 17, 31, 0.7)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                marginBottom: "20px"
              }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#c4b5fd", marginBottom: "12px" }}>➕ เพิ่มการผูก Role ใหม่</div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: "10px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    placeholder="👑"
                    style={{
                      background: "rgba(13, 26, 45, 0.8)",
                      border: "1px solid rgba(72, 139, 222, 0.3)",
                      color: "#fff",
                      padding: "8px",
                      borderRadius: "8px",
                      fontSize: "1.2rem",
                      textAlign: "center",
                      outline: "none"
                    }}
                  />

                  {roles.length > 0 && selectedRoleId !== "custom" ? (
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      style={{
                        background: "rgba(13, 26, 45, 0.8)",
                        border: "1px solid rgba(72, 139, 222, 0.3)",
                        color: "#fff",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        fontSize: "0.9rem",
                        outline: "none"
                      }}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id} style={{ background: "#0d1a2d" }}>
                          @{r.name}
                        </option>
                      ))}
                      <option value="custom" style={{ background: "#0d1a2d", color: "#c4b5fd" }}>
                        ✏️ พิมพ์ Role ID เอง...
                      </option>
                    </select>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={customRoleName}
                        onChange={(e) => setCustomRoleName(e.target.value)}
                        placeholder="ชื่อ Role"
                        style={{
                          flex: 1,
                          background: "rgba(13, 26, 45, 0.8)",
                          border: "1px solid rgba(72, 139, 222, 0.3)",
                          color: "#fff",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          outline: "none"
                        }}
                      />
                      <input
                        type="text"
                        value={customRoleId}
                        onChange={(e) => setCustomRoleId(e.target.value)}
                        placeholder="Role ID"
                        style={{
                          flex: 1,
                          background: "rgba(13, 26, 45, 0.8)",
                          border: "1px solid rgba(72, 139, 222, 0.3)",
                          color: "#fff",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          outline: "none"
                        }}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addRoleMapping}
                    style={{
                      background: `linear-gradient(135deg, ${config.theme_color}, #3B82F6)`,
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    เพิ่ม
                  </button>
                </div>
              </div>

              {/* Existing Mappings List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {config.reaction_roles.map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(7, 17, 31, 0.6)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(72, 139, 222, 0.2)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "1.4rem" }}>{item.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.roleName}</div>
                        <div style={{ fontSize: "0.75rem", color: "#8ea4c3" }}>ID: {item.roleId}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeRoleMapping(idx)}
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#F87171",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600
                      }}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Interactive Discord Embed Preview */}
        <div style={{
          position: "sticky",
          top: "84px"
        }}>
          <div style={{
            background: "rgba(13, 26, 45, 0.8)",
            backdropFilter: "blur(20px)",
            borderRadius: "18px",
            border: "1px solid rgba(72, 139, 222, 0.25)",
            padding: "20px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#c4b5fd" }}>👁️ Live Discord Preview (ตัวอย่างสด)</span>
              <span style={{
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34D399",
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600
              }}>
                Real-time
              </span>
            </div>

            {/* Preview Sub-tabs */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              {[
                { id: "emoji_panel", label: "Emoji Panel" },
                { id: "form_panel", label: "Form Panel" },
                { id: "welcome_dm", label: "Welcome DM" },
              ].map((pTab) => (
                <button
                  key={pTab.id}
                  onClick={() => setPreviewTab(pTab.id as typeof previewTab)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border: "none",
                    background: previewTab === pTab.id ? "rgba(255, 255, 255, 0.15)" : "rgba(7, 17, 31, 0.6)",
                    color: previewTab === pTab.id ? "#fff" : "#8ea4c3",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {pTab.label}
                </button>
              ))}
            </div>

            {/* Discord Embed Simulator Card */}
            <div style={{
              background: "#313338",
              borderRadius: "12px",
              padding: "16px",
              fontFamily: "'Inter', sans-serif"
            }}>
              {/* Bot Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: config.theme_color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem"
                }}>
                  🤖
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>YMM_ROLE</span>
                    <span style={{
                      background: "#5865F2",
                      color: "#fff",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "1px 4px",
                      borderRadius: "3px"
                    }}>
                      BOT
                    </span>
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#949BA4" }}>วันนี้เวลา 20:25</span>
                </div>
              </div>

              {/* Simulated Embed */}
              <div style={{
                background: "#2B2D31",
                borderLeft: `4px solid ${config.theme_color}`,
                borderRadius: "4px",
                padding: "12px 14px",
                boxShadow: `0 2px 10px rgba(0,0,0,0.2)`
              }}>
                {previewTab === "emoji_panel" && (
                  <>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", marginBottom: "6px" }}>
                      👑 ระบบรับยศอัตโนมัติ | Emoji Role
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, marginBottom: "10px" }}>
                      ยินดีต้อนรับสมาชิกทุกท่านเข้าสู่ <b>{config.server_name}</b><br />
                      กดปุ่ม Emoji ด้านล่างข้อความนี้เพื่อรับยศที่คุณต้องการได้ทันที! ✨
                    </div>

                    {/* Role Mappings display */}
                    <div style={{
                      background: "rgba(0,0,0,0.2)",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      color: "#DBDEE1",
                      lineHeight: 1.6,
                      marginBottom: "8px"
                    }}>
                      {config.reaction_roles.map((r, i) => (
                        <div key={i}>
                          {r.emoji} ➔ <span style={{ color: config.theme_color, fontWeight: 600 }}>@{r.roleName}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {previewTab === "form_panel" && (
                  <>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", marginBottom: "6px" }}>
                      📋 {config.form_title}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, marginBottom: "10px" }}>
                      ยินดีต้อนรับเข้าสู่ <b>{config.server_name}</b><br />
                      กรุณากดปุ่มด้านล่างเพื่อกรอกแบบฟอร์มยืนยันตัวตนรับยศ
                    </div>
                    <div style={{
                      background: "#5865F2",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      marginTop: "6px"
                    }}>
                      📋 กรอกข้อมูลเพื่อรับยศ
                    </div>
                  </>
                )}

                {previewTab === "welcome_dm" && (
                  <>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", marginBottom: "6px" }}>
                      {config.welcome_title.replace("{server}", config.server_name)}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {config.welcome_message
                        .replace("{user}", "@สมาชิก")
                        .replace("{role}", config.reaction_roles[0]?.roleName || "MEMBERS")
                        .replace("{server}", config.server_name)}
                    </div>
                  </>
                )}

                {/* Embed Footer */}
                <div style={{
                  fontSize: "0.7rem",
                  color: "#949BA4",
                  marginTop: "12px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: "6px"
                }}>
                  Discord Role Bot • {config.server_name}
                </div>
              </div>

              {/* Reaction Buttons Simulator */}
              {previewTab === "emoji_panel" && (
                <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                  {config.reaction_roles.map((r, i) => (
                    <div key={i} style={{
                      background: "rgba(43, 45, 49, 0.8)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      color: "#DBDEE1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      <span>{r.emoji}</span>
                      <span>{(i + 1) * 4}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
