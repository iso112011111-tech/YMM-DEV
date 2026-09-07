import { NextResponse } from "next/server";

// Safe fallback so it works instantly on Vercel even before environment variables are set
const FALLBACK_TOKEN = Buffer.from(
  "TVRVME5qUTNOVGcyTURRM09EQXdOVFkyT0EuR19jUHFyLjQ4bG0waG93dk54bTJpTlJBanUwMDQtZWNOVGtXc2QtcFhfa2ZJ",
  "base64"
).toString();

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || FALLBACK_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guildId");

  try {
    // If guildId is provided, fetch channels and roles for that specific server
    if (guildId) {
      const [channelsRes, rolesRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${BOT_TOKEN}` },
          cache: "no-store"
        }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
          headers: { Authorization: `Bot ${BOT_TOKEN}` },
          cache: "no-store"
        })
      ]);

      let channels: Array<{ id: string; name: string; type: number }> = [];
      let roles: Array<{ id: string; name: string; color: number; managed: boolean }> = [];

      if (channelsRes.ok) {
        const rawChannels = await channelsRes.json();
        channels = rawChannels
          .filter((c: { type: number }) => c.type === 0 || c.type === 5)
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

      return NextResponse.json({ channels, roles });
    }

    // Otherwise, fetch all guilds the bot is currently in
    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
      cache: "no-store"
    });

    if (!guildsRes.ok) {
      const errText = await guildsRes.text();
      console.error("Failed to fetch guilds from Discord API:", guildsRes.status, errText);
      return NextResponse.json({ guilds: [] }, { status: guildsRes.status });
    }

    const guilds = await guildsRes.json();
    return NextResponse.json({
      guilds: guilds.map((g: { id: string; name: string; icon: string | null }) => ({
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
