import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";
import { readSession, SESSION_COOKIE, type DiscordProfile } from "@/lib/discordAuth";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// -------------------------------------------------------------
// 1. Firebase Admin Instances (Separated for Role & Ticket bots)
// -------------------------------------------------------------

export function getTicketAdminDb(): Firestore {
  const appName = "ticketAdminApp";
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return getFirestore(existing);

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
    const localPaths = [
      path.resolve(process.cwd(), "serviceAccountKey.json"),
      path.resolve(process.cwd(), "../botticket/serviceAccountKey.json"),
    ];
    for (const p of localPaths) {
      if (fs.existsSync(p)) {
        try {
          credential = cert(JSON.parse(fs.readFileSync(p, "utf8")));
          break;
        } catch (e) {
          console.warn(`Reading local serviceAccountKey from ${p} failed:`, e);
        }
      }
    }
  }

  const app = credential
    ? initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID || "botticket-8b709" }, appName)
    : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "botticket-8b709" }, appName);

  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function getRoleAdminDb(): Firestore {
  const appName = "roleAdminApp";
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return getFirestore(existing);

  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_ROLE) {
    try {
      credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_ROLE));
    } catch (e) {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY_ROLE parse error:", e);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_ROLE) {
    try {
      credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_ROLE));
    } catch (e) {
      console.warn("FIREBASE_SERVICE_ACCOUNT_JSON_ROLE parse error:", e);
    }
  } else {
    const localPaths = [
      path.resolve(process.cwd(), "serviceAccountKeyRole.json"),
      path.resolve(process.cwd(), "../botrole/serviceAccountKey.json"),
    ];
    for (const p of localPaths) {
      if (fs.existsSync(p)) {
        try {
          credential = cert(JSON.parse(fs.readFileSync(p, "utf8")));
          break;
        } catch (e) {
          console.warn(`Reading local role serviceAccountKey from ${p} failed:`, e);
        }
      }
    }
  }

  const app = credential
    ? initializeApp({ credential, projectId: "botdiscord-role" }, appName)
    : initializeApp({ projectId: "botdiscord-role" }, appName);

  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// -------------------------------------------------------------
// 2. Authorization & Bitmask Verification
// -------------------------------------------------------------

export async function verifyGuildAdmin(
  request: Request,
  guildId: string,
  botType: "ticket" | "role" = "ticket"
): Promise<{ authorized: boolean; profile?: DiscordProfile; error?: string; status?: number }> {
  if (!guildId) {
    return { authorized: false, error: "Missing guild ID", status: 400 };
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];

  const profile = readSession(sessionCookie);
  if (!profile) {
    return { authorized: false, error: "Unauthorized: กรุณาเข้าสู่ระบบ Discord", status: 401 };
  }

  // 1. ตรวจสอบจาก Session Cookie (0x8 = ADMINISTRATOR, 0x20 = MANAGE_GUILD)
  const isGuildAdminInCookie = profile.guilds?.some((g: any) => {
    if (g.id !== guildId) return false;
    if (g.owner) return true;
    if (g.permissions) {
      try {
        const perm = BigInt(g.permissions);
        return (perm & BigInt(0x8)) !== BigInt(0) || (perm & BigInt(0x20)) !== BigInt(0);
      } catch {
        return false;
      }
    }
    // หากไม่มี permissions field ชัดเจน ไม่อนุญาต ให้ส่งไปตรวจสอบผ่าน Discord API แบบ Realtime แทน
    return false;
  });

  if (isGuildAdminInCookie) {
    return { authorized: true, profile };
  }

  // 2. Fallback ตรวจสอบผ่าน Discord API แบบ Realtime หากมี Bot Token
  const token = (
    botType === "role"
      ? (process.env.DISCORD_ROLE_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || "")
      : (process.env.DISCORD_TICKET_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || "")
  ).replace(/['"]/g, "").trim();
  if (token) {
    try {
      const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      });
      if (guildRes.ok) {
        const guildData = await guildRes.json();
        if (guildData.owner_id === profile.id) {
          return { authorized: true, profile };
        }
      }

      const [memberRes, rolesRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${profile.id}`, {
          headers: { Authorization: `Bot ${token}` },
          cache: "no-store",
        }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
          headers: { Authorization: `Bot ${token}` },
          cache: "no-store",
        }),
      ]);

      if (memberRes.ok && rolesRes.ok) {
        const memberData = await memberRes.json();
        const rolesData = (await rolesRes.json()) as Array<{ id: string; permissions: string }>;
        const memberRoleIds = new Set<string>(memberData.roles || []);

        for (const role of rolesData) {
          if (memberRoleIds.has(role.id)) {
            try {
              const perm = BigInt(role.permissions);
              if ((perm & BigInt(0x8)) !== BigInt(0) || (perm & BigInt(0x20)) !== BigInt(0)) {
                return { authorized: true, profile };
              }
            } catch {
              // ignore parse error
            }
          }
        }
      }
    } catch (err) {
      console.warn("Realtime Discord API check notice:", err);
    }
  }

  return {
    authorized: false,
    profile,
    error: "Forbidden: คุณไม่มีสิทธิ์จัดการเซิร์ฟเวอร์นี้ (ต้องมีสิทธิ์ Admin หรือ Manage Server)",
    status: 403,
  };
}

// -------------------------------------------------------------
// 3. AES-256-GCM Encryption for BYOK API Keys (Matching botticket)
// -------------------------------------------------------------

export function encryptApiKey(plaintext: string, guildId: string): string {
  const masterKeyHex =
    process.env.ENCRYPTION_KEY || "088b8aaf4817b9e81eb8a17a029997bf96e619cf12e01d9cdfd26cfb7c9e4661";

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
    key = Buffer.from(masterKeyHex, "hex");
  } else {
    key = Buffer.from(masterKeyHex, "base64");
    if (key.length !== 32) {
      throw new Error("Master key must be 32 bytes (256 bits)");
    }
  }

  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });

  if (guildId) {
    cipher.setAAD(Buffer.from(String(guildId), "utf8"));
  }

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
