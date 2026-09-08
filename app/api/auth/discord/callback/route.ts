import { NextResponse } from "next/server";
import {
  createSession,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  type DiscordProfile,
} from "@/lib/discordAuth";

interface DiscordTokenResponse {
  access_token?: string;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([name]) => name === OAUTH_STATE_COOKIE)?.[1];

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid Discord OAuth state" }, { status: 400 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Discord OAuth is not configured" },
      { status: 500 }
    );
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "Discord token exchange failed" }, { status: 502 });
  }

  const token = (await tokenResponse.json()) as DiscordTokenResponse;
  if (!token.access_token) {
    return NextResponse.json({ error: "Discord did not return an access token" }, { status: 502 });
  }

  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!profileResponse.ok) {
    return NextResponse.json({ error: "Could not load Discord profile" }, { status: 502 });
  }

  const discordProfile = (await profileResponse.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  // Fetch manageable guilds (Admin or Manage Server)
  let guilds: { id: string; name: string; icon: string | null; owner?: boolean }[] = [];
  try {
    const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (guildsResponse.ok) {
      const allGuilds = (await guildsResponse.json()) as Array<{
        id: string;
        name: string;
        icon: string | null;
        owner: boolean;
        permissions: string;
      }>;

      guilds = allGuilds
        .filter((g) => {
          if (g.owner) return true;
          try {
            const perm = BigInt(g.permissions);
            // 0x8 = ADMINISTRATOR, 0x20 = MANAGE_GUILD
            return (perm & BigInt(0x28)) !== BigInt(0);
          } catch {
            return false;
          }
        })
        .slice(0, 15) // Keep cookie payload lightweight
        .map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
        }));
    }
  } catch (err) {
    console.warn("Could not fetch user guilds:", err);
  }

  const profile: DiscordProfile = {
    id: discordProfile.id,
    username: discordProfile.username,
    globalName: discordProfile.global_name ?? null,
    avatar: discordProfile.avatar ?? null,
    guilds,
  };

  const redirectCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === "ymm_oauth_redirect")?.[1];

  const isValidRedirect = Boolean(redirectCookie && redirectCookie.startsWith("/") && !redirectCookie.startsWith("//"));
  const safeRedirect = isValidRedirect ? (redirectCookie as string) : "/dashboard";

  const response = NextResponse.redirect(new URL(safeRedirect, request.url));
  response.cookies.set(SESSION_COOKIE, createSession(profile), sessionCookieOptions());
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set("ymm_oauth_redirect", "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
