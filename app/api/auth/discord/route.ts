import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/discordAuth";

const DISCORD_CLIENT_ID = "1546488470355054642";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID || DISCORD_CLIENT_ID;
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI ||
    new URL("/api/auth/discord/callback", request.url).toString();

  const state = randomBytes(24).toString("hex");
  const authorizationUrl = new URL("https://discord.com/oauth2/authorize");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", "identify");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
