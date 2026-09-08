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
  panel_title?: string;
  panel_description?: string;
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
  panel_title: "👑 ระบบรับยศอัตโนมัติ | Emoji Role",
  panel_description: "ยินดีต้อนรับสมาชิกทุกท่านเข้าสู่ **{server}**\nกดปุ่ม Emoji ด้านล่างข้อความนี้เพื่อรับยศที่คุณต้องการได้ทันที! ✨",
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

function sanitizeConfig(data: any): DashboardConfig {
  return {
    guild_id: data?.guild_id || DEFAULT_CONFIG.guild_id,
    server_name: data?.server_name || DEFAULT_CONFIG.server_name,
    theme_color: data?.theme_color || DEFAULT_CONFIG.theme_color,
    system_type: data?.system_type || DEFAULT_CONFIG.system_type,
    log_channel_id: data?.log_channel_id || DEFAULT_CONFIG.log_channel_id,
    panel_channel_id: data?.panel_channel_id || DEFAULT_CONFIG.panel_channel_id,
    panel_title: data?.panel_title || DEFAULT_CONFIG.panel_title,
    panel_description: data?.panel_description || DEFAULT_CONFIG.panel_description,
    welcome_enabled: typeof data?.welcome_enabled === "boolean" ? data.welcome_enabled : DEFAULT_CONFIG.welcome_enabled,
    welcome_title: data?.welcome_title || DEFAULT_CONFIG.welcome_title,
    welcome_message: data?.welcome_message || DEFAULT_CONFIG.welcome_message,
    form_title: data?.form_title || DEFAULT_CONFIG.form_title,
    form_role_id: data?.form_role_id || DEFAULT_CONFIG.form_role_id,
    form_questions: Array.isArray(data?.form_questions) ? data.form_questions : [...DEFAULT_CONFIG.form_questions],
    reaction_roles: Array.isArray(data?.reaction_roles) ? data.reaction_roles : [...DEFAULT_CONFIG.reaction_roles],
  };
}

export default function DashboardPage() {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"appearance" | "system" | "welcome" | "form" | "roles">("roles");
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
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  // Permission Checks
  const isLoggedIn = Boolean(profile);
  const hasBotInCurrentServer = (botGuilds || []).some((g) => g.id === config.guild_id);
  const isAccessible = isLoggedIn && hasBotInCurrentServer;

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
      .catch((err) => console.warn("Could not load bot guilds:", err))
      .finally(() => setLoadingGuilds(false));
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
        setConfig((prev) => sanitizeConfig({ ...prev, ...snapshot.data() }));
      }
    }).catch((err) => {
      console.warn("Firestore fetch notice:", err);
    });

    // Real-time sync listener
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setConfig((prev) => sanitizeConfig({ ...prev, ...snapshot.data() }));
      }
    });

    return () => unsubscribe();
  }, [config.guild_id]);

  // Handle Save to Firebase Firestore
  const handleSave = async () => {
    if (!profile) {
      alert("กรุณาเข้าสู่ระบบ Discord ก่อนบันทึกการตั้งค่า");
      return;
    }
    if (!hasBotInCurrentServer) {
      alert("ไม่สามารถบันทึกได้ เนื่องจากเซิร์ฟเวอร์นี้ยังไม่ได้ติดตั้งบอท YMM_ROLE");
      return;
    }
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
        ...(prev.reaction_roles || []),
        { emoji: newEmoji, roleName: roleNameToAdd, roleId: roleIdToAdd }
      ]
    }));

    setCustomRoleName("");
    setCustomRoleId("");
  };

  const removeRoleMapping = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      reaction_roles: (prev.reaction_roles || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c1322",
      color: "#f1f5f9",
      fontFamily: "Inter, var(--font-manrope), sans-serif",
      paddingBottom: "80px"
    }}>
      {/* Top Clean Header Navbar */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(12, 19, 34, 0.95)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "14px 28px"
      }}>
        <div style={{
          maxWidth: "1350px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          {/* Brand Logo & Name */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "#fff" }}>
              <Image src={logo} alt="YMM-DEV" width={32} height={32} style={{ borderRadius: "8px" }} />
              <span style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.01em" }}>YMM-DEV</span>
            </Link>
          </div>

          {/* Right Actions: Server Selector, Profile & Save Settings Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Live Server Selector Dropdown */}
            {profile && (
              botGuilds.length > 0 && !isCustomServer ? (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: "6px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.1)"
                }}>
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>Server:</span>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255, 255, 255, 0.06)", padding: "6px 12px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
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
                      style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
                    >
                      ย้อนกลับ
                    </button>
                  )}
                </div>
              )
            )}

            {/* Profile Avatar Badge */}
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
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setProfile(null);
                    setConfig((prev) => ({
                      ...prev,
                      guild_id: "",
                      server_name: ""
                    }));
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
                href="/api/auth/discord?redirect=/dashboard"
                style={{
                  background: "#2563EB",
                  color: "#fff",
                  padding: "8px 16px",
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

            {/* Clean Save Settings Button (Matching screenshot) */}
            <button
              onClick={handleSave}
              disabled={saving || (!loadingAuth && !loadingGuilds && !isAccessible)}
              style={{
                background: (saving || (!loadingAuth && !loadingGuilds && !isAccessible))
                  ? "#334155" 
                  : "#2563EB",
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: (saving || (!loadingAuth && !loadingGuilds && !isAccessible)) ? "not-allowed" : "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{
        maxWidth: "1350px",
        margin: "24px auto",
        padding: "0 28px",
        position: "relative"
      }}>
        {/* Permission Protection Gray Overlay */}
        {!loadingAuth && !loadingGuilds && !isAccessible && (
          <div style={{
            position: "absolute",
            top: 0,
            left: "28px",
            right: "28px",
            bottom: 0,
            background: "rgba(12, 19, 34, 0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 40,
            borderRadius: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            minHeight: "520px"
          }}>
            <div style={{
              background: "#131d31",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: "40px 32px",
              maxWidth: "520px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)"
            }}>
              {!isLoggedIn ? (
                <>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "10px" }}>
                    คุณยังไม่ได้เข้าสู่ระบบ Discord
                  </h2>
                  <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "28px" }}>
                    กรุณาเข้าสู่ระบบด้วยบัญชี Discord ของคุณ เพื่อยืนยันสิทธิ์ในการดูแลเซิร์ฟเวอร์ก่อนเข้าจัดการบอท
                  </p>
                  <a
                    href="/api/auth/discord?redirect=/dashboard"
                    style={{
                      background: "#2563EB",
                      color: "#fff",
                      padding: "12px 28px",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center"
                    }}
                  >
                    Log In Discord
                  </a>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "10px" }}>
                    ไม่พบบอทในเซิร์ฟเวอร์นี้
                  </h2>
                  <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "24px" }}>
                    เซิร์ฟเวอร์ที่คุณเลือกยังไม่ได้ติดตั้งบอท <b style={{ color: "#fff" }}>YMM_ROLE</b><br />
                    กรุณาเชิญบอทเข้าสู่เซิร์ฟเวอร์ก่อน จึงจะสามารถตั้งค่าระบบรับยศและบันทึกข้อมูลได้ครับ
                  </p>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                    <a
                      href="https://discord.com/oauth2/authorize?client_id=1546475860478005268&permissions=8&integration_type=0&scope=bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "#2563EB",
                        color: "#fff",
                        padding: "12px 24px",
                        borderRadius: "10px",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        textDecoration: "none"
                      }}
                    >
                      เชิญบอทเข้าเซิร์ฟเวอร์
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Two-Column Grid Layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "28px",
          alignItems: "start",
          filter: (!loadingAuth && !loadingGuilds && !isAccessible) ? "grayscale(80%) blur(2px)" : "none",
          pointerEvents: (!loadingAuth && !loadingGuilds && !isAccessible) ? "none" : "auto"
        }}>
          {/* Left Column: Config Panels & Navigation Pills */}
          <div>
            {/* Save Toast Status */}
            {saveStatus === "success" && (
              <div style={{
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid #10B981",
                color: "#34D399",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                fontSize: "0.9rem",
                fontWeight: 600
              }}>
                บันทึกการตั้งค่าสำเร็จ! ข้อมูลถูกอัปเดตเรียลไทม์เรียบร้อยแล้ว
              </div>
            )}

            {/* Clean Modern Navigation Tabs Bar (Matching Reference Screenshot) */}
            <div style={{
              display: "flex",
              gap: "6px",
              background: "#131d31",
              padding: "6px",
              borderRadius: "14px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: "24px"
            }}>
              {[
                { id: "appearance", label: "🎨 Theme" },
                { id: "system", label: "⚙️ System" },
                { id: "welcome", label: "💬 Welcome" },
                { id: "form", label: "📄 Forms" },
                { id: "roles", label: "🔗 Emoji / Role" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: activeTab === tab.id ? "rgba(255, 255, 255, 0.12)" : "transparent",
                    color: activeTab === tab.id ? "#ffffff" : "#94a3b8",
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: Theme & Color Settings */}
            {activeTab === "appearance" && (
              <div style={{
                background: "#131d31",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>Theme & Color Configuration</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  เลือกสีธีมหลักสำหรับแผงรับยศ Embed ใน Discord
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setConfig({ ...config, theme_color: preset.hex })}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: config.theme_color === preset.hex ? `2px solid ${preset.hex}` : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "10px",
                        padding: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px"
                      }}
                    >
                      <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: preset.hex }} />
                      <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600 }}>{preset.name}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Custom Hex Code</label>
                  <input
                    type="text"
                    value={config.theme_color}
                    onChange={(e) => setConfig({ ...config, theme_color: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0c1322",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: System Settings */}
            {activeTab === "system" && (
              <div style={{
                background: "#131d31",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>System Settings</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  กำหนดรูปแบบระบบรับยศและเลือกช่องสำหรับส่ง Admin Log
                </p>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Admin Log Channel</label>
                  <select
                    value={config.log_channel_id}
                    onChange={(e) => setConfig({ ...config, log_channel_id: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0c1322",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      outline: "none"
                    }}
                  >
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id} style={{ background: "#0c1322" }}>
                        #{ch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: Welcome DM Settings */}
            {activeTab === "welcome" && (
              <div style={{
                background: "#131d31",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>Welcome Message Settings</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  ส่งข้อความต้อนรับเข้ากล่องข้อความส่วนตัว (DM) เมื่อสมาชิกรับยศสำเร็จ
                </p>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Title</label>
                  <input
                    type="text"
                    value={config.welcome_title}
                    onChange={(e) => setConfig({ ...config, welcome_title: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0c1322",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Message</label>
                  <textarea
                    rows={4}
                    value={config.welcome_message}
                    onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0c1322",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 4: Form Setup */}
            {activeTab === "form" && (
              <div style={{
                background: "#131d31",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>Modal Form Setup</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  ตั้งค่าแบบฟอร์มยืนยันตัวตนสำหรับสมาชิกก่อนรับยศ
                </p>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Form Title</label>
                  <input
                    type="text"
                    value={config.form_title}
                    onChange={(e) => setConfig({ ...config, form_title: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0c1322",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 5: Role Automation / Emoji & Role Mapping (Matching Reference Image) */}
            {activeTab === "roles" && (
              <div style={{
                background: "#131d31",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(255, 255, 255, 0.08)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "1.1rem", color: "#fff" }}>🔗</span>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Role Automation (Configure)</h2>
                </div>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  กำหนดว่าเมื่อสมาชิกกด Emoji แต่ละตัว จะได้รับบทบาทอะไร โดยเลือก Role จากเซิร์ฟเวอร์ได้ทันที
                </p>

                {/* Custom Panel Embed Text Configuration */}
                <div style={{
                  background: "#17233c",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  marginBottom: "20px"
                }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>📝</span> Custom Panel Message (ตั้งค่าข้อความในแผงรับยศ)
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>Panel Title (หัวข้อแผงรับยศ)</label>
                    <input
                      type="text"
                      value={config.panel_title || ""}
                      onChange={(e) => setConfig({ ...config, panel_title: e.target.value })}
                      placeholder="👑 ระบบรับยศอัตโนมัติ | Emoji Role"
                      style={{
                        width: "100%",
                        height: "40px",
                        background: "#0f172a",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        padding: "0 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>Panel Description (ข้อความรายละเอียดในแผงรับยศ)</label>
                    <textarea
                      rows={3}
                      value={config.panel_description || ""}
                      onChange={(e) => setConfig({ ...config, panel_description: e.target.value })}
                      placeholder="ยินดีต้อนรับสมาชิกทุกท่านเข้าสู่ {server}&#10;กดปุ่ม Emoji ด้านล่างข้อความนี้เพื่อรับยศที่คุณต้องการได้ทันที! ✨"
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        outline: "none",
                        resize: "vertical"
                      }}
                    />
                  </div>
                </div>

                {/* Inner Card: Add New Role Link */}
                <div style={{
                  background: "#17233c",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  marginBottom: "24px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "12px" }}>
                    <span>🔗</span> Add New Role Link
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 90px", gap: "10px", alignItems: "center" }}>
                    {/* Emoji input square box */}
                    <input
                      type="text"
                      value={newEmoji}
                      onChange={(e) => setNewEmoji(e.target.value)}
                      placeholder="😊"
                      style={{
                        width: "48px",
                        height: "42px",
                        background: "#0f172a",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        borderRadius: "8px",
                        fontSize: "1.2rem",
                        textAlign: "center",
                        outline: "none"
                      }}
                    />

                    {/* Role selector dropdown */}
                    {roles.length > 0 && selectedRoleId !== "custom" ? (
                      <select
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                        style={{
                          height: "42px",
                          background: "#0f172a",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#fff",
                          padding: "0 14px",
                          borderRadius: "8px",
                          fontSize: "0.9rem",
                          outline: "none",
                          cursor: "pointer"
                        }}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id} style={{ background: "#0c1322" }}>
                            @{r.name}
                          </option>
                        ))}
                        <option value="custom" style={{ background: "#0c1322", color: "#cbd5e1" }}>
                          Custom Role ID...
                        </option>
                      </select>
                    ) : (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          value={customRoleName}
                          onChange={(e) => setCustomRoleName(e.target.value)}
                          placeholder="Role Name"
                          style={{
                            flex: 1,
                            height: "42px",
                            background: "#0f172a",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#fff",
                            padding: "0 12px",
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
                            height: "42px",
                            background: "#0f172a",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#fff",
                            padding: "0 12px",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            outline: "none"
                          }}
                        />
                      </div>
                    )}

                    {/* Add button */}
                    <button
                      type="button"
                      onClick={addRoleMapping}
                      style={{
                        height: "42px",
                        background: "#2563EB",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: "0.9rem"
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Table Header & Existing Mappings List */}
                <div style={{ marginTop: "10px" }}>
                  {/* Table Header Labels */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1.5fr 2fr 70px",
                    padding: "0 14px 10px 14px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    letterSpacing: "0.05em"
                  }}>
                    <span>EMOJI</span>
                    <span>ROLE</span>
                    <span>ID</span>
                    <span style={{ textAlign: "right" }}></span>
                  </div>

                  {/* Mapping Rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(config.reaction_roles || []).map((item, idx) => (
                      <div key={idx} style={{
                        display: "grid",
                        gridTemplateColumns: "60px 1.5fr 2fr 70px",
                        alignItems: "center",
                        background: "#17233c",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.06)"
                      }}>
                        <span style={{ fontSize: "1.3rem" }}>{item.emoji}</span>
                        <div>
                          <span style={{
                            background: "rgba(59, 130, 246, 0.2)",
                            color: "#60a5fa",
                            padding: "3px 10px",
                            borderRadius: "14px",
                            fontSize: "0.85rem",
                            fontWeight: 600
                          }}>
                            @{item.roleName}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontFamily: "monospace" }}>
                          ID: {item.roleId}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => removeRoleMapping(idx)}
                            style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "none",
                              color: "#fca5a5",
                              padding: "4px 12px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600
                            }}
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Discord Preview Card */}
          <div style={{ position: "sticky", top: "84px" }}>
            <div style={{
              background: "#131d31",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#fff" }}>Live Discord Preview</span>
                <span style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34D399",
                  fontSize: "0.75rem",
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34D399" }} /> Live
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
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: previewTab === pTab.id ? "rgba(255, 255, 255, 0.12)" : "rgba(12, 19, 34, 0.6)",
                      color: previewTab === pTab.id ? "#fff" : "#94a3b8",
                      fontSize: "0.8rem",
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
                    background: config.theme_color || "#3B82F6",
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
                  borderLeft: `4px solid ${config.theme_color || '#3B82F6'}`,
                  borderRadius: "4px",
                  padding: "12px 14px"
                }}>
                  {previewTab === "emoji_panel" && (
                    <>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", marginBottom: "6px" }}>
                        {config.panel_title || "👑 ระบบรับยศอัตโนมัติ | Emoji Role"}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, marginBottom: "10px", whiteSpace: "pre-wrap" }}>
                        {(config.panel_description || "ยินดีต้อนรับสมาชิกทุกท่านเข้าสู่ **{server}**\nกดปุ่ม Emoji ด้านล่างข้อความนี้เพื่อรับยศที่คุณต้องการได้ทันที! ✨")
                          .replace("{server}", config.server_name || "Server")}
                      </div>

                      <div style={{
                        background: "rgba(0,0,0,0.2)",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "#DBDEE1",
                        lineHeight: 1.6,
                        marginBottom: "8px"
                      }}>
                        {(config.reaction_roles || []).map((r, i) => (
                          <div key={i}>
                            {r.emoji} ➔ <span style={{ color: config.theme_color || '#3B82F6', fontWeight: 600 }}>@{r.roleName}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {previewTab === "form_panel" && (
                    <>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", marginBottom: "6px" }}>
                        📋 {config.form_title || 'แบบฟอร์มกรอกข้อมูลเพื่อรับยศ'}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, marginBottom: "10px" }}>
                        ยินดีต้อนรับเข้าสู่ <b>{config.server_name || 'Server'}</b><br />
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
                        {(config.welcome_title || "").replace("{server}", config.server_name || "Server")}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {(config.welcome_message || "")
                          .replace("{user}", "@สมาชิก")
                          .replace("{role}", (config.reaction_roles || [])[0]?.roleName || "MEMBERS")
                          .replace("{server}", config.server_name || "Server")}
                      </div>
                    </>
                  )}

                  <div style={{
                    fontSize: "0.7rem",
                    color: "#949BA4",
                    marginTop: "12px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    paddingTop: "6px"
                  }}>
                    Discord Role Bot • {config.server_name || "Server"}
                  </div>
                </div>

                {/* Reaction Simulator */}
                {previewTab === "emoji_panel" && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                    {(config.reaction_roles || []).map((r, i) => (
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
    </div>
  );
}
