import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ymm_discord_session";
export const OAUTH_STATE_COOKIE = "ymm_discord_oauth_state";

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
}

export interface DiscordProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  guilds?: DiscordGuild[];
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return secret;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSession(profile: DiscordProfile) {
  const payload = encode(
    JSON.stringify({
      ...profile,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  );

  return `${payload}.${sign(payload)}`;
}

export function readSession(value: string | undefined): DiscordProfile | null {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(decode(payload)) as DiscordProfile & { exp?: number };
    if (!session.exp || session.exp < Date.now()) return null;

    return {
      id: session.id,
      username: session.username,
      globalName: session.globalName,
      avatar: session.avatar,
      guilds: session.guilds ?? [],
    };
  } catch {
    return null;
  }
}

export function getDiscordAvatarUrl(profile: DiscordProfile) {
  return profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 5}.png`;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}
