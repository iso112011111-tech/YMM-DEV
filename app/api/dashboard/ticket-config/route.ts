import { NextResponse } from "next/server";
import { getTicketAdminDb, verifyGuildAdmin, encryptApiKey } from "@/lib/serverFirestore";
import { FieldValue, FieldPath } from "firebase-admin/firestore";

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

    // Fold any legacy literal dot-keyed fields into nested maps for safety
    for (const [key, val] of Object.entries(data)) {
      if (key.includes(".")) {
        const [parent, child] = key.split(".", 2);
        if (!data[parent] || typeof data[parent] !== "object") data[parent] = {};
        if (data[parent][child] === undefined) {
          data[parent][child] = val;
        }
      }
    }

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

async function testGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; status?: number }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (res.ok) {
      return { valid: true };
    }

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return {
        valid: false,
        error: "API Key ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง Gemini API",
        status: 400,
      };
    } else if (res.status === 429) {
      return {
        valid: false,
        error: "API Key นี้ใช้ quota เกินกำหนดแล้ว",
        status: 429,
      };
    } else if (res.status >= 500) {
      return {
        valid: false,
        error: "ไม่สามารถเชื่อมต่อ Gemini API ได้ในขณะนี้ กรุณาลองใหม่",
        status: 502,
      };
    } else {
      return {
        valid: false,
        error: `ตรวจสอบ API Key ล้มเหลว (HTTP ${res.status})`,
        status: 400,
      };
    }
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return {
        valid: false,
        error: "การตรวจสอบใช้เวลานานเกินไป กรุณาลองใหม่",
        status: 504,
      };
    }
    return {
      valid: false,
      error: "ไม่สามารถเชื่อมต่อ Gemini API ได้ในขณะนี้ กรุณาลองใหม่",
      status: 502,
    };
  }
}

function flattenToDotNotation(prefix: string, obj: Record<string, any>, target: Record<string, any>) {
  if (!obj || typeof obj !== "object") return;
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    target[`${prefix}.${key}`] = value;
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

    // 1. Embed Customization: Dynamic flatten to dot-notation
    if (body.embed_customization && typeof body.embed_customization === "object") {
      flattenToDotNotation("embed_customization", body.embed_customization, updates);
    }

    // 2. Ticket Config: Dynamic flatten to dot-notation (preserves ticket_counter, etc.)
    if (body.ticket_config && typeof body.ticket_config === "object") {
      flattenToDotNotation("ticket_config", body.ticket_config, updates);
    }

    // 3. AI Configuration: Explicit control for encryption & security (never flatten raw api_key)
    if (body.ai_config && typeof body.ai_config === "object") {
      const ai = body.ai_config;
      if (ai.provider !== undefined) updates["ai_config.provider"] = ai.provider;
      if (ai.model !== undefined) updates["ai_config.model"] = ai.model;
      if (ai.is_active !== undefined) updates["ai_config.is_active"] = Boolean(ai.is_active);
      if (ai.channel_id !== undefined) updates["ai_config.channel_id"] = ai.channel_id;
      if (Array.isArray(ai.channel_ids)) updates["ai_config.channel_ids"] = ai.channel_ids;

      // Validate and encrypt only if a new API key was submitted
      if (ai.api_key && typeof ai.api_key === "string" && ai.api_key.trim()) {
        const plainKey = ai.api_key.trim();

        // 1. Health check Gemini API Key directly
        const testResult = await testGeminiApiKey(plainKey);
        if (!testResult.valid) {
          return NextResponse.json(
            { error: testResult.error, field: "api_key" },
            { status: testResult.status || 400 }
          );
        }

        // 2. Encrypt key securely
        const encrypted = encryptApiKey(plainKey, guildId);
        updates["ai_config.encrypted_api_key"] = encrypted;
        updates["ai_config.has_api_key"] = true;
        updates["ai_config.api_key_updated_at"] = new Date().toISOString();
        updates["ai_config.last_tested_at"] = FieldValue.serverTimestamp();
      }
    }

    // Special trigger for syncing Discord panel
    if (body.sync_panel_channel_id) {
      updates["ticket_config.sync_panel_channel_id"] = body.sync_panel_channel_id;
      updates["ticket_config.sync_panel_trigger"] = Date.now();
    }

    // Ensure document exists before update, and use update() for true dot-notation nesting in Firestore
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      await docRef.set({
        guild_id: guildId,
        created_at: FieldValue.serverTimestamp(),
      });
    } else {
      // Auto-cleanup any garbage literal dot keys created by earlier set({ merge: true })
      const data = docSnap.data() || {};
      for (const key of Object.keys(data)) {
        if (key.includes(".")) {
          updates[new FieldPath(key) as unknown as string] = FieldValue.delete();
        }
      }
    }

    await docRef.update(updates);

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
