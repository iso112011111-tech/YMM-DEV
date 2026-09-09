import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/discordAuth";
import { verifyGuildAdmin, verifyUserIsAdmin, checkUserAdminInSession } from "@/lib/serverFirestore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchWithToken(url: string, token: string) {
  return await fetch(url, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store"
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guildId");
  const botType = searchParams.get("bot") === "ticket" ? "ticket" : "role";

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

  const activeToken = (
    botType === "ticket"
      ? (process.env.DISCORD_TICKET_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || "")
      : (process.env.DISCORD_ROLE_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || "")
  ).replace(/['"]/g, "").trim();

  if (!activeToken) {
    return NextResponse.json(
      { error: "Server configuration error: bot token missing" },
      { status: 500 }
    );
  }

  try {
    // 2. Fetch all guilds the bot is currently in
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

    // If guildId is provided, fetch channels, categories, and roles for that server
    if (guildId) {
      // 1. Verify user is admin/owner of THIS guild
      const auth = await verifyGuildAdmin(request, guildId, botType);
      if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
      }

      // 2. Verify bot is in THIS guild
      const isBotInGuild = botGuilds.some((bg: { id: string }) => bg.id === guildId);
      if (!isBotInGuild) {
        return NextResponse.json(
          { error: "บอทยังไม่ได้เข้าร่วมเซิร์ฟเวอร์นี้ กรุณาเชิญบอทก่อน" },
          { status: 404 }
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

    // Return ONLY servers where:
    // 1) The bot is in the server AND
    // 2) The authenticated user is owner OR has ADMINISTRATOR (0x8) / MANAGE_GUILD (0x20)
    const accessibleGuilds: Array<{ id: string; name: string; icon: string | null }> = [];
    const botGuildMap = new Map(botGuilds.map((bg: { id: string; name: string; icon: string | null }) => [bg.id, bg]));
    const checkedGuildIds = new Set<string>();

    // 1. Process guilds present in the user's session cookie
    for (const ug of profile.guilds || []) {
      if (!botGuildMap.has(ug.id)) continue;
      checkedGuildIds.add(ug.id);

      if (checkUserAdminInSession(profile, ug.id)) {
        const bg = botGuildMap.get(ug.id)!;
        accessibleGuilds.push({
          id: bg.id,
          name: bg.name,
          icon: bg.icon
            ? `https://cdn.discordapp.com/icons/${bg.id}/${bg.icon}.png?size=64`
            : null
        });
      } else {
        // Fallback for old session cookies without permissions field: verify via Discord API
        const isAdmin = await verifyUserIsAdmin(profile, ug.id, botType);
        if (isAdmin) {
          const bg = botGuildMap.get(ug.id)!;
          accessibleGuilds.push({
            id: bg.id,
            name: bg.name,
            icon: bg.icon
              ? `https://cdn.discordapp.com/icons/${bg.id}/${bg.icon}.png?size=64`
              : null
          });
        }
      }
    }

    // 2. Fallback: If there are remaining bot guilds not in the user's session cookie (e.g. truncated),
    // verify them in parallel up to 15 guilds to prevent hitting Discord rate limits
    const uncheckedBotGuilds = botGuilds.filter((bg) => !checkedGuildIds.has(bg.id));
    if (uncheckedBotGuilds.length > 0 && uncheckedBotGuilds.length <= 15) {
      await Promise.all(
        uncheckedBotGuilds.map(async (bg) => {
          const isAdmin = await verifyUserIsAdmin(profile, bg.id, botType);
          if (isAdmin) {
            accessibleGuilds.push({
              id: bg.id,
              name: bg.name,
              icon: bg.icon
                ? `https://cdn.discordapp.com/icons/${bg.id}/${bg.icon}.png?size=64`
                : null
            });
          }
        })
      );
    }

    return NextResponse.json({ guilds: accessibleGuilds });
  } catch (error) {
    console.error("Discord API fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Discord data" }, { status: 500 });
  }
}
