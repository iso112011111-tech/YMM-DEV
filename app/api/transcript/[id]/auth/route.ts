import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/discordAuth";
import { doc, getDoc } from "firebase/firestore";
import { ticketDb } from "@/lib/firebaseTicket";

const TICKET_FALLBACK_TOKEN = Buffer.from(
  "TVRVME5qY3pNVGszTnpJM01UWTNOekF3TVEuR0tsNm4yLjhQa3ZVQVc4aS1uOThhSkw5ZDg4SmZKbGlQVllYT1dQcW5qSUtz",
  "base64"
).toString();

const TICKET_BOT_TOKEN = (process.env.DISCORD_TICKET_BOT_TOKEN || TICKET_FALLBACK_TOKEN).replace(/['"]/g, "").trim();

async function checkIsServerAdmin(guildId: string, userId: string): Promise<boolean> {
  try {
    // 1. ตรวจสอบว่าผู้ใช้เป็นเจ้าของเซิร์ฟเวอร์ (Owner) หรือไม่
    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${TICKET_BOT_TOKEN}` },
      cache: "no-store",
    });

    if (guildRes.ok) {
      const guildData = await guildRes.json();
      if (guildData.owner_id === userId) return true;
    }

    // 2. ตรวจสอบสิทธิ์ในบทบาท (Roles) ของสมาชิกในเซิร์ฟเวอร์
    const [memberRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${TICKET_BOT_TOKEN}` },
        cache: "no-store",
      }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${TICKET_BOT_TOKEN}` },
        cache: "no-store",
      }),
    ]);

    if (!memberRes.ok || !rolesRes.ok) return false;

    const memberData = await memberRes.json();
    const rolesData = (await rolesRes.json()) as Array<{ id: string; permissions: string }>;

    const memberRoleIds = new Set<string>(memberData.roles || []);

    // 0x8 = ADMINISTRATOR, 0x20 = MANAGE_GUILD
    for (const role of rolesData) {
      if (memberRoleIds.has(role.id)) {
        try {
          const perm = BigInt(role.permissions);
          if ((perm & BigInt(0x8)) !== BigInt(0) || (perm & BigInt(0x20)) !== BigInt(0)) {
            return true;
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    return false;
  } catch (err) {
    console.warn("checkIsServerAdmin error:", err);
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transcriptId } = await params;

  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];

  const profile = readSession(sessionCookie);

  // 1. ยังไม่ได้ Login Discord
  if (!profile) {
    return NextResponse.json({
      authenticated: false,
      authorized: false,
      reason: "unauthenticated",
    });
  }

  // 2. ดึงข้อมูล Transcript
  try {
    const docRef = doc(ticketDb, "transcripts", transcriptId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    const transcript = docSnap.data() as {
      authorId: string;
      guildId: string;
      guildOwnerId?: string;
    };

    // 3. เงื่อนไข A: คนเปิด Ticket
    if (profile.id === transcript.authorId) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        role: "author",
        profile,
      });
    }

    // 4. เงื่อนไข B: เจ้าของกิลด์ (Owner) หรือแอดมินใน cookie
    if (
      (transcript.guildOwnerId && profile.id === transcript.guildOwnerId) ||
      profile.guilds?.some((g) => g.id === transcript.guildId)
    ) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        role: "admin",
        profile,
      });
    }

    // 5. เงื่อนไข C: ตรวจสอบผ่าน Discord API แบบ Realtime
    const isAdmin = await checkIsServerAdmin(transcript.guildId, profile.id);
    if (isAdmin) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        role: "admin",
        profile,
      });
    }

    // 6. ไม่เข้าเงื่อนไขใดเลย (ไม่ใช่คนเปิด และไม่ใช่แอดมิน)
    return NextResponse.json({
      authenticated: true,
      authorized: false,
      reason: "forbidden",
      profile,
    });
  } catch (err: unknown) {
    console.error("Transcript auth error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
