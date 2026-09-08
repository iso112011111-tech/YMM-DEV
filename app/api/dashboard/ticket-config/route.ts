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

    // 1. Embed Customization (Dot-notation to prevent replacing nested map)
    if (body.embed_customization) {
      const ec = body.embed_customization;
      if (ec.panel_title !== undefined) updates["embed_customization.panel_title"] = ec.panel_title;
      if (ec.panel_description !== undefined) updates["embed_customization.panel_description"] = ec.panel_description;
      if (ec.panel_color !== undefined) updates["embed_customization.panel_color"] = ec.panel_color;
      if (ec.welcome_message !== undefined) updates["embed_customization.welcome_message"] = ec.welcome_message;
      if (ec.footer_text !== undefined) updates["embed_customization.footer_text"] = ec.footer_text;
      if (ec.button_text !== undefined) updates["embed_customization.button_text"] = ec.button_text;
      if (ec.button_style !== undefined) updates["embed_customization.button_style"] = ec.button_style;
      if (ec.button_emoji !== undefined) updates["embed_customization.button_emoji"] = ec.button_emoji;
      if (ec.button_color !== undefined) updates["embed_customization.button_color"] = ec.button_color;
      if (Array.isArray(ec.categories)) updates["embed_customization.categories"] = ec.categories;
    }

    // 2. Ticket Config (Dot-notation to preserve ticket_counter, etc.)
    if (body.ticket_config) {
      const tc = body.ticket_config;
      if (tc.category_id !== undefined) updates["ticket_config.category_id"] = tc.category_id;
      if (tc.log_channel_id !== undefined) updates["ticket_config.log_channel_id"] = tc.log_channel_id;
      if (Array.isArray(tc.staff_role_ids)) updates["ticket_config.staff_role_ids"] = tc.staff_role_ids;
      if (tc.supervisor_role_id !== undefined) updates["ticket_config.supervisor_role_id"] = tc.supervisor_role_id;
      if (typeof tc.sla_minutes === "number") updates["ticket_config.sla_minutes"] = tc.sla_minutes;
      if (typeof tc.auto_close_hours === "number") updates["ticket_config.auto_close_hours"] = tc.auto_close_hours;
    }

    // 3. AI Configuration (Dot-notation to never erase encrypted_api_key)
    if (body.ai_config) {
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
