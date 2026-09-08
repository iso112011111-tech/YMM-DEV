import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/discordAuth";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const TICKET_BOT_TOKEN = (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TICKET_BOT_TOKEN || "")
  .replace(/['"]/g, "")
  .trim();

function getAdminFirestore() {
  if (getApps().length === 0) {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
      } catch (e) {
        console.warn("FIREBASE_SERVICE_ACCOUNT_KEY parse error:", e);
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
      } catch (e) {
        console.warn("FIREBASE_SERVICE_ACCOUNT_JSON parse error:", e);
      }
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID || "botticket-8b709",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
    } else {
      const pathsToCheck = [
        path.resolve(process.cwd(), "serviceAccountKey.json"),
        path.resolve(process.cwd(), "../botticket/serviceAccountKey.json"),
      ];
      for (const p of pathsToCheck) {
        if (fs.existsSync(p)) {
          try {
            const raw = fs.readFileSync(p, "utf8");
            credential = cert(JSON.parse(raw));
            break;
          } catch (e) {
            console.warn(`Error reading service account from ${p}:`, e);
          }
        }
      }
    }

    if (credential) {
      initializeApp({
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID || "botticket-8b709",
      });
    } else {
      try {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || "botticket-8b709",
        });
      } catch (e) {
        console.warn("Firebase Admin initializeApp fallback error:", e);
      }
    }
  }

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

async function checkIsServerAdmin(guildId: string, userId: string): Promise<boolean> {
  if (!TICKET_BOT_TOKEN) return false;

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

  if (!transcriptId) {
    return NextResponse.json({ error: "Missing transcript ID" }, { status: 400 });
  }

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

  // 2. ดึงข้อมูล Transcript ผ่าน Firebase Admin SDK (Bypass Security Rules ปลอดภัยฝั่ง Server)
  try {
    const adminDb = getAdminFirestore();
    const docRef = adminDb.collection("transcripts").doc(transcriptId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    const transcript = docSnap.data() as {
      authorId: string;
      guildId: string;
      guildOwnerId?: string;
      expiresAtMs?: number;
      createdAtMs?: number;
      [key: string]: unknown;
    };

    // 3. ตรวจสอบเงื่อนไขหมดอายุ (เกิน 30 วันนับจากวันที่สร้าง)
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const isExpired =
      (typeof transcript.expiresAtMs === "number" && now > transcript.expiresAtMs) ||
      (typeof transcript.createdAtMs === "number" && now - transcript.createdAtMs > thirtyDaysMs);

    if (isExpired) {
      // Server-side cleanup: ลบข้อมูลที่หมดอายุออกจากฐานข้อมูลโดยอัตโนมัติ
      await docRef.delete().catch((delErr) => {
        console.warn("Server delete expired transcript error:", delErr);
      });
      return NextResponse.json({
        expired: true,
        authenticated: true,
        authorized: false,
        reason: "expired",
      });
    }

    // คำนวณวันที่เหลือก่อนหมดอายุ
    const targetExpiry =
      transcript.expiresAtMs ||
      (transcript.createdAtMs ? transcript.createdAtMs + thirtyDaysMs : now + thirtyDaysMs);
    const diff = targetExpiry - now;
    const remainingDays = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));

    const payloadData = {
      id: transcriptId,
      ...transcript,
    };

    // 4. เงื่อนไข A: คนเปิด Ticket
    if (profile.id === transcript.authorId) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        role: "author",
        profile,
        transcript: payloadData,
        remainingDays,
      });
    }

    // 5. เงื่อนไข B: เจ้าของกิลด์ (Owner) หรือแอดมินใน cookie
    // ตรวจสอบ permission bitmask จริง (ADMINISTRATOR 0x8 หรือ MANAGE_GUILD 0x20)
    const isOwner = Boolean(
      (transcript.guildOwnerId && profile.id === transcript.guildOwnerId) ||
      profile.guilds?.some((g: { id: string; owner?: boolean }) => g.id === transcript.guildId && g.owner)
    );

    const hasAdminInCookie = Boolean(
      profile.guilds?.some((g: { id: string; owner?: boolean; permissions?: string }) => {
        if (g.id !== transcript.guildId) return false;
        if (g.owner) return true;
        if (g.permissions) {
          try {
            const perm = BigInt(g.permissions);
            return (perm & BigInt(0x8)) !== BigInt(0) || (perm & BigInt(0x20)) !== BigInt(0);
          } catch {
            return false;
          }
        }
        return false;
      })
    );

    if (isOwner || hasAdminInCookie) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        role: "admin",
        profile,
        transcript: payloadData,
        remainingDays,
      });
    }

    // 6. เงื่อนไข C: ตรวจสอบผ่าน Discord API แบบ Realtime
    const isAdmin = await checkIsServerAdmin(transcript.guildId, profile.id);
    if (isAdmin) {
      return NextResponse.json({
        authenticated: true,
        authorized: true,
        role: "admin",
        profile,
        transcript: payloadData,
        remainingDays,
      });
    }

    // 7. ไม่เข้าเงื่อนไขใดเลย (ไม่ใช่คนเปิด และไม่ใช่แอดมิน)
    // คืนค่าเฉพาะสถานะสิทธิ์ ไม่ส่ง payloadData คืนกลับ ป้องกันการรั่วไหลของข้อมูล
    return NextResponse.json({
      authenticated: true,
      authorized: false,
      reason: "forbidden",
      profile,
    });
  } catch (err: unknown) {
    console.error("Transcript auth & read error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
