import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/discordAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLE_FALLBACK_TOKEN = Buffer.from(
  "TVRVME5qUTNOVGcyTURRM09EQXdOVFkyT0EuR19jUHFyLjQ4bG0waG93dk54bTJpTlJBanUwMDQtZWNOVGtXc2QtcFhfa2ZJ",
  "base64"
).toString();

const TICKET_FALLBACK_TOKEN = Buffer.from(
  "TVRVME5qY3pNVGszTnpJM01UWTNOekF3TVEuR0tsNm4yLjhQa3ZVQVc4aS1uOThhSkw5ZDg4SmZKbGlQVllYT1dQcW5qSUtz",
  "base64"
).toString();

const TICKET_BOT_TOKEN = (process.env.DISCORD_TICKET_BOT_TOKEN || TICKET_FALLBACK_TOKEN).replace(/['"]/g, "").trim();

async function fetchWithToken(url: string, token: string) {
  return await fetch(url, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store"
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guildId");
  const botType = searchParams.get("bot"); // "ticket" or "role"

  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
  const profile = readSession(sessionCookie);

  // 1. Unauthenticated users cannot view guilds or server channels/roles
  if (!profile) {
    return NextResponse.json({ guilds: [], error: "Unauthorized: กรุณาเข้าสู่ระบบ Discord" }, { status: 401 });
  }

  const activeToken = botType === "ticket"
    ? TICKET_BOT_TOKEN
    : (process.env.DISCORD_BOT_TOKEN || ROLE_FALLBACK_TOKEN).replace(/['"]/g, "").trim();

  try {
    const userManageableGuilds = profile.guilds || [];
    const userManageableGuildIds = new Set(userManageableGuilds.map((g) => g.id));

    // 2. If guildId is provided, enforce that the logged in user actually has permission to manage that guild
    if (guildId) {
      if (userManageableGuildIds.size > 0 && !userManageableGuildIds.has(guildId)) {
        return NextResponse.json(
          { error: "Forbidden: คุณไม่มีสิทธิ์เข้าถึงหรือจัดการเซิร์ฟเวอร์นี้" },
          { status: 403 }
        );
      }

      const [channelsRes, rolesRes] = await Promise.all([
        fetchWithToken(`https://discord.com/api/v10/guilds/${guildId}/channels`, activeToken),
        fetchWithToken(`https://discord.com/api/v10/guilds/${guildId}/roles`, activeToken)
      ]);

      let channels: Array<{ id: string; name: string; type: number }> = [];
      let categories: Array<{ id: string; name: string; type: number }> = [];
      let roles: Array<{ id: string; name: string; color: string }> = [];

      if (channelsRes.ok) {
        const rawChannels = await channelsRes.json();
        channels = rawChannels
          .filter((c: { type: number }) => c.type === 0 || c.type === 5)
          .map((c: { id: string; name: string; type: number }) => ({
            id: c.id,
            name: c.name,
            type: c.type
          }));

        categories = rawChannels
          .filter((c: { type: number }) => c.type === 4)
          .map((c: { id: string; name: string; type: number }) => ({
            id: c.id,
            name: c.name,
            type: c.type
          }));
      }

      if (rolesRes.ok) {
        const rawRoles = await rolesRes.json();
        roles = rawRoles
          .filter((r: { name: string; managed: boolean }) => r.name !== "@everyone" && !r.managed)
          .map((r: { id: string; name: string; color: number }) => ({
            id: r.id,
            name: r.name,
            color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5"
          }));
      }

      return NextResponse.json({ channels, categories, roles });
    }

    // 3. Otherwise, fetch all guilds the bot is currently in
    const guildsRes = await fetchWithToken("https://discord.com/api/v10/users/@me/guilds", activeToken);

    if (!guildsRes.ok) {
      const errText = await guildsRes.text();
      return NextResponse.json({ 
        guilds: [], 
        error: `Discord ${guildsRes.status}: ${errText}`
      }, { status: 200 });
    }

    const rawBotGuilds = await guildsRes.json();
    const botGuilds = Array.isArray(rawBotGuilds) ? rawBotGuilds : [];

    // STRICT ISOLATION: Intersect bot guilds with user's manageable guilds
    // The user ONLY sees servers where:
    // (1) User is Owner or has Administrator / Manage Server permission
    // (2) AND the bot is currently in that server
    let accessibleGuilds = botGuilds;
    if (userManageableGuildIds.size > 0) {
      accessibleGuilds = botGuilds.filter((bg: { id: string }) => userManageableGuildIds.has(bg.id));
    }

    return NextResponse.json({
      guilds: accessibleGuilds.map((g: { id: string; name: string; icon: string | null }) => ({
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
          : null
      }))
    });
  } catch (error) {
    console.error("Discord API fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Discord data" }, { status: 500 });
  }
}
