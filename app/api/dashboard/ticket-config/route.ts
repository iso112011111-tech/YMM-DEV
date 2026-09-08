import { NextResponse } from "next/server";
import { getTicketAdminDb, verifyGuildAdmin, encryptApiKey } from "@/lib/serverFirestore";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guild_id");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guild_id" }, { status: 400 });
  }

  const auth = await verifyGuildAdmin(request, guildId, "ticket");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
  }

  try {
    const db = getTicketAdminDb();
    const docRef = db.collection("guilds").doc(guildId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ exists: false, config: null });
    }

    const data = docSnap.data() || {};

    // Don't send back encrypted key, just indicate whether a key is configured
    if (data.ai_config) {
      data.ai_config.has_api_key = Boolean(
        data.ai_config.encrypted_api_key || data.ai_config.has_api_key
      );
      delete data.ai_config.encrypted_api_key;
      delete data.ai_config.raw_api_key_web;
      delete data.ai_config.api_key;
    }

    return NextResponse.json({
      exists: true,
      config: {
        guild_id: guildId,
        ...data,
      },
    });
  } catch (error: any) {
    console.error("GET ticket-config error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลการตั้งค่า Ticket Bot" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const guildId = body.guild_id;

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild_id" }, { status: 400 });
    }

    const auth = await verifyGuildAdmin(request, guildId, "ticket");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
    }

    const db = getTicketAdminDb();
    const docRef = db.collection("guilds").doc(guildId);

    const updates: Record<string, any> = {
      guild_id: guildId,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (body.guild_name) updates.guild_name = body.guild_name;
    if (body.embed_customization) updates.embed_customization = body.embed_customization;
    if (body.ticket_config) updates.ticket_config = body.ticket_config;

    // Handle AI Configuration and Secure In-Memory Encryption
    if (body.ai_config) {
      const ai = { ...body.ai_config };

      // If user submitted a new API Key, encrypt immediately with AES-256-GCM + Guild ID AAD
      if (ai.api_key && typeof ai.api_key === "string" && ai.api_key.trim()) {
        const plainKey = ai.api_key.trim();
        const encrypted = encryptApiKey(plainKey, guildId);
        ai.encrypted_api_key = encrypted;
        ai.has_api_key = true;
        ai.api_key_updated_at = new Date().toISOString();
      }

      // STRICT SECURITY: Remove all raw key traces
      delete ai.api_key;
      delete ai.raw_api_key_web;

      updates.ai_config = ai;
    }

    // Special trigger for syncing Discord panel
    if (body.sync_panel_channel_id) {
      updates["ticket_config.sync_panel_channel_id"] = body.sync_panel_channel_id;
      updates["ticket_config.sync_panel_trigger"] = Date.now();
    }

    await docRef.set(updates, { merge: true });

    return NextResponse.json({
      success: true,
      message: "บันทึกการตั้งค่า Ticket สำเร็จ",
    });
  } catch (error: any) {
    console.error("POST ticket-config error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า Ticket Bot" },
      { status: 500 }
    );
  }
}
