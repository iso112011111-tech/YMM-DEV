import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/discordAuth";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionValue = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
  const profile = readSession(sessionValue);

  return NextResponse.json({ profile });
}
