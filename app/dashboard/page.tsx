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
  form_description?: string;
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
  guild_id: "",
  server_name: "My Server",
  theme_color: "#8B5CF6",
  system_type: "both",
  log_channel_id: "",
  panel_channel_id: "",
  panel_title: "👑 ระบบรับยศอัตโนมัติ | Emoji Role",
  panel_description: "ยินดีต้อนรับสมาชิกทุกท่านเข้าสู่ **{server}**\nกดปุ่ม Emoji ด้านล่างข้อความนี้เพื่อรับยศที่คุณต้องการได้ทันที! ✨",
  welcome_enabled: true,
  welcome_title: "🎉 ยินดีต้อนรับสู่ {server}!",
  welcome_message: "สวัสดี {user}\n\nคุณได้รับยศ 👑 {role} เรียบร้อยแล้ว\nขอให้สนุกกับการใช้งาน Server ของเรานะครับ 💜",
  form_title: "แบบฟอร์มกรอกข้อมูลเพื่อรับยศ",
  form_description: "ยินดีต้อนรับเข้าสู่ **{server}**\nกรุณากดปุ่มด้านล่างเพื่อกรอกแบบฟอร์มยืนยันตัวตนรับยศ",
  form_role_id: "",
  form_questions: ["ชื่อ-นามสกุล หรือ ชื่อเล่น", "อายุ", "เหตุผลที่เข้าร่วมเซิร์ฟเวอร์"],
  reaction_roles: []
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
    form_description: data?.form_description || DEFAULT_CONFIG.form_description,
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
      const activeServerName = botGuilds.find((g) => g.id === config.guild_id)?.name || config.server_name || "Server";
      const configToSave = {
        ...config,
        server_name: activeServerName,
        updated_at: new Date().toISOString()
      };
      const docRef = doc(db, "guilds", config.guild_id);
      await setDoc(docRef, configToSave, { merge: true });

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
    <div className="role-dashboard-root" style={{
      minHeight: "100vh",
      background: "#0c1322",
      color: "#f1f5f9",
      fontFamily: "Inter, var(--font-manrope), sans-serif",
      paddingBottom: "80px"
    }}>
      {/* Top Clean Header Navbar */}
      <header className="role-header">
        <div className="role-header-inner">
          {/* Brand Logo & Profile on Mobile (Row 1 on Mobile / Left on Desktop) */}
          <div className="role-header-brand-row">
            <Link href="/" className="role-logo-link">
              <Image src={logo} alt="YMM-DEV" width={32} height={32} style={{ borderRadius: "8px" }} />
              <span className="role-brand-text">YMM-DEV</span>
              <span className="role-badge">Role Bot</span>
            </Link>

            {/* Profile Avatar Pill on Mobile (compact top-right) */}
            <div className="role-profile-mobile-wrap">
              {profile ? (
                <div className="role-user-pill">
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
                  <span className="role-user-name">
                    {profile.globalName || profile.username}
                  </span>
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
                    className="role-logout-btn"
                    title="ออกจากระบบ"
                  >
                    ออก
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/discord?redirect=/dashboard"
                  className="role-login-btn"
                >
                  Log In
                </a>
              )}
            </div>
          </div>

          {/* Controls: Server Selector & Save Button (Row 2 on Mobile / Right on Desktop) */}
          <div className="role-header-controls-row">
            {/* Live Server Selector Dropdown */}
            {profile && (
              botGuilds.length > 0 && !isCustomServer ? (
                <div className="role-server-select-wrap">
                  <span className="role-server-label">Server:</span>
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
                    className="role-server-select"
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
                <div className="role-server-select-wrap">
                  <span className="role-server-label">Server ID:</span>
                  <input
                    type="text"
                    value={config.guild_id}
                    onChange={(e) => setConfig({ ...config, guild_id: e.target.value })}
                    className="role-server-input"
                    placeholder="ID เซิร์ฟเวอร์..."
                  />
                  {botGuilds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomServer(false)}
                      className="role-back-btn"
                    >
                      ย้อนกลับ
                    </button>
                  )}
                </div>
              )
            )}

            {/* Profile Avatar Badge on Desktop */}
            <div className="role-profile-desktop-wrap">
              {profile ? (
                <div className="role-user-pill">
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
                  <span className="role-user-name">
                    {profile.globalName || profile.username}
                  </span>
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
                    className="role-logout-btn"
                    title="ออกจากระบบ"
                  >
                    ออก
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/discord?redirect=/dashboard"
                  className="role-login-btn"
                >
                  Log In Discord
                </a>
              )}
            </div>

            {/* Clean Save Settings Button */}
            <button
              onClick={handleSave}
              disabled={saving || (!loadingAuth && !loadingGuilds && !isAccessible)}
              className="role-save-btn"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="role-dashboard-main" style={{
        maxWidth: "1350px",
        margin: "18px auto",
        position: "relative"
      }}>
        {/* Permission Protection Gray Overlay */}
        {!loadingAuth && !loadingGuilds && !isAccessible && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
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
            <div className="role-perm-modal" style={{
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
        <div 
          className="dash-role-grid"
          style={{
            filter: (!loadingAuth && !loadingGuilds && !isAccessible) ? "grayscale(80%) blur(2px)" : "none",
            pointerEvents: (!loadingAuth && !loadingGuilds && !isAccessible) ? "none" : "auto"
          }}
        >
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
            <div className="role-tabs-bar">
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
                  className={`role-tab-btn ${activeTab === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: Theme & Color Settings */}
            {activeTab === "appearance" && (
              <div className="role-panel-card">
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>Theme & Color Configuration</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  เลือกสีธีมหลักสำหรับแผงรับยศ Embed ใน Discord
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "24px" }}>
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
              <div className="role-panel-card">
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
              <div className="role-panel-card">
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
              <div className="role-panel-card">
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>Modal Form Setup</h2>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  ตั้งค่าแบบฟอร์มยืนยันตัวตน คำถามที่จะให้กรอก และเลือก Role ที่จะมอบเมื่อทำรายการสำเร็จ
                </p>

                {/* Form Title Input */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Form Title (หัวข้อแบบฟอร์ม)</label>
                  <input
                    type="text"
                    value={config.form_title}
                    onChange={(e) => setConfig({ ...config, form_title: e.target.value })}
                    placeholder="แบบฟอร์มกรอกข้อมูลเพื่อรับยศ"
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

                {/* Form Description Input */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Form Description (คำอธิบายแผงแบบฟอร์ม)</label>
                  <textarea
                    rows={3}
                    value={config.form_description || ""}
                    onChange={(e) => setConfig({ ...config, form_description: e.target.value })}
                    placeholder="ยินดีต้อนรับเข้าสู่ **{server}**&#10;กรุณากดปุ่มด้านล่างเพื่อกรอกแบบฟอร์มยืนยันตัวตนรับยศ"
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

                {/* Form Assigned Role Selector */}
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>Assigned Role (Role ที่จะมอบเมื่อกรอกฟอร์มผ่าน)</label>
                  {roles.length > 0 ? (
                    <select
                      value={config.form_role_id}
                      onChange={(e) => setConfig({ ...config, form_role_id: e.target.value })}
                      style={{
                        width: "100%",
                        background: "#0c1322",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#fff",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id} style={{ background: "#0c1322" }}>
                          @{r.name} (ID: {r.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={config.form_role_id}
                      onChange={(e) => setConfig({ ...config, form_role_id: e.target.value })}
                      placeholder="Role ID เช่น 1546299207269224521"
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
                  )}
                </div>

                {/* Form Questions List */}
                <div style={{
                  background: "#17233c",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.08)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>
                      📝 รายการช่องคำถามใน Modal Form (สูงสุด 5 ข้อ)
                    </label>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {(config.form_questions || []).length}/5 ข้อ
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {(config.form_questions || []).map((q, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "#0f172a",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.08)"
                      }}>
                        <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600, width: "24px" }}>#{idx + 1}</span>
                        <input
                          type="text"
                          value={q}
                          onChange={(e) => {
                            const updated = [...(config.form_questions || [])];
                            updated[idx] = e.target.value;
                            setConfig({ ...config, form_questions: updated });
                          }}
                          style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            fontSize: "0.85rem",
                            outline: "none"
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setConfig({
                              ...config,
                              form_questions: (config.form_questions || []).filter((_, i) => i !== idx)
                            });
                          }}
                          style={{
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "none",
                            color: "#fca5a5",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Question Input */}
                  {(config.form_questions || []).length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newQ = prompt("พิมพ์คำถามที่ต้องการเพิ่มในแบบฟอร์ม:");
                        if (newQ && newQ.trim()) {
                          setConfig({
                            ...config,
                            form_questions: [...(config.form_questions || []), newQ.trim()]
                          });
                        }
                      }}
                      style={{
                        width: "100%",
                        background: "#2563EB",
                        color: "#fff",
                        border: "none",
                        padding: "10px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer"
                      }}
                    >
                      + เพิ่มช่องคำถามใหม่
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: Role Automation / Emoji & Role Mapping (Matching Reference Image) */}
            {activeTab === "roles" && (
              <div className="role-panel-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "1.1rem", color: "#fff" }}>🔗</span>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Role Automation (Configure)</h2>
                </div>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "20px" }}>
                  กำหนดว่าเมื่อสมาชิกกด Emoji แต่ละตัว จะได้รับบทบาทอะไร โดยเลือก Role จากเซิร์ฟเวอร์ได้ทันที
                </p>

                {/* Custom Panel Embed Text Configuration */}
                <div className="role-inner-card">
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
                <div className="role-inner-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: 600, color: "#fff", marginBottom: "12px" }}>
                    <span>🔗</span> Add New Role Link
                  </div>

                  <div className="role-add-container">
                    {/* Row 1: Emoji + Role selector or Role Name */}
                    <div className="role-add-row-top">
                      <input
                        type="text"
                        value={newEmoji}
                        onChange={(e) => setNewEmoji(e.target.value)}
                        placeholder="😊"
                        className="role-add-emoji"
                      />

                      {roles.length > 0 && selectedRoleId !== "custom" ? (
                        <select
                          value={selectedRoleId}
                          onChange={(e) => setSelectedRoleId(e.target.value)}
                          className="role-add-select"
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
                        <input
                          type="text"
                          value={customRoleName}
                          onChange={(e) => setCustomRoleName(e.target.value)}
                          placeholder="ชื่อยศ (Role Name)"
                          className="role-add-name-input"
                        />
                      )}
                    </div>

                    {/* Row 2: Role ID input if custom */}
                    {!(roles.length > 0 && selectedRoleId !== "custom") && (
                      <div className="role-add-row-id">
                        <input
                          type="text"
                          value={customRoleId}
                          onChange={(e) => setCustomRoleId(e.target.value)}
                          placeholder="ไอดีบทบาท (Role ID เช่น 1546299207269224521)"
                          className="role-add-id-input"
                        />
                        {roles.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedRoleId(roles[0]?.id || "")}
                            className="role-back-btn"
                          >
                            เลือกจากเซิร์ฟเวอร์
                          </button>
                        )}
                      </div>
                    )}

                    {/* Row 3: Add button */}
                    <button
                      type="button"
                      onClick={addRoleMapping}
                      className="role-add-btn"
                    >
                      + เพิ่มยศ (Add Role)
                    </button>
                  </div>
                </div>

                {/* Table Header & Existing Mappings List */}
                <div style={{ marginTop: "10px" }}>
                  {/* Table Header Labels */}
                  <div className="role-mapping-header">
                    <span>EMOJI</span>
                    <span>ROLE</span>
                    <span>ID</span>
                    <span style={{ textAlign: "right" }}>ACTION</span>
                  </div>

                  {/* Mapping Rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(config.reaction_roles || []).map((item, idx) => (
                      <div key={idx} className="role-mapping-row">
                        <div className="role-mapping-info">
                          <span className="role-mapping-emoji">{item.emoji}</span>
                          <span className="role-mapping-badge">
                            @{item.roleName}
                          </span>
                          <span className="role-mapping-id">
                            ID: {item.roleId}
                          </span>
                        </div>
                        <div className="role-mapping-action">
                          <button
                            type="button"
                            onClick={() => removeRoleMapping(idx)}
                            className="role-del-btn"
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
                        {(config.form_title || 'แบบฟอร์มกรอกข้อมูลเพื่อรับยศ').startsWith('📋')
                          ? (config.form_title || 'แบบฟอร์มกรอกข้อมูลเพื่อรับยศ')
                          : `📋 ${config.form_title || 'แบบฟอร์มกรอกข้อมูลเพื่อรับยศ'}`}
                      </div>

                      <div style={{ fontSize: "0.85rem", color: "#DBDEE1", lineHeight: 1.5, marginBottom: "10px", whiteSpace: "pre-wrap" }}>
                        {(config.form_description || "ยินดีต้อนรับเข้าสู่ **{server}**\nเพื่อความปลอดภัยและความเป็นระเบียบของเซิร์ฟเวอร์\nกรุณากดปุ่มด้านล่างเพื่อกรอกแบบฟอร์มยืนยันตัวตนรับยศ")
                          .replace(/{server}/g, config.server_name || "Server")}
                        <br /><br />
                        ยศที่จะได้รับเมื่อส่งข้อมูล: <span style={{ color: config.theme_color || '#8B5CF6', fontWeight: 600 }}>
                          @{roles.find(r => r.id === config.form_role_id)?.name || (config.reaction_roles || [])[0]?.roleName || "MMR"}
                        </span>
                        <br /><br />
                        ⚡ <i>ระบบจะตรวจสอบข้อมูลและมอบยศให้อัตโนมัติทันทีหลังส่งฟอร์ม</i>
                      </div>

                      <div style={{
                        background: "rgba(0, 0, 0, 0.2)",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "#DBDEE1",
                        lineHeight: 1.6,
                        marginBottom: "8px"
                      }}>
                        <div style={{ fontWeight: 600, color: "#fff", marginBottom: "2px" }}>
                          📝 ข้อมูลที่ต้องกรอก
                        </div>
                        {(config.form_questions && config.form_questions.length > 0
                          ? config.form_questions
                          : ["ชื่อ-นามสกุล / ชื่อเล่น", "อายุ", "เหตุผลที่เข้าร่วมเซิร์ฟเวอร์"]
                        ).map((q, i) => (
                          <div key={i}>• {q}</div>
                        ))}
                      </div>

                      <div style={{
                        background: "rgba(0, 0, 0, 0.2)",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "#DBDEE1",
                        lineHeight: 1.6,
                        marginBottom: "10px"
                      }}>
                        <div style={{ fontWeight: 600, color: "#fff", marginBottom: "2px" }}>
                          🛡️ ความเป็นส่วนตัว
                        </div>
                        <div>ข้อมูลทั้งหมดจะถูกบันทึกเพื่อความปลอดภัยของคอมมูนิตี้เท่านั้น</div>
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
                    Discord Role Bot • ปลอดภัย เชื่อถือได้ ใช้งานได้ 24 ชม.
                  </div>
                </div>

                {/* Form Button Simulator */}
                {previewTab === "form_panel" && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{
                      background: "#5865F2",
                      color: "#fff",
                      padding: "7px 14px",
                      borderRadius: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }}>
                      📋 กรอกข้อมูลเพื่อรับยศ
                    </div>
                  </div>
                )}

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
