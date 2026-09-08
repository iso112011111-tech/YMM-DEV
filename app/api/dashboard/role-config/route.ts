import { NextResponse } from "next/server";
import { getRoleAdminDb, verifyGuildAdmin } from "@/lib/serverFirestore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guild_id");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guild_id" }, { status: 400 });
  }

  const auth = await verifyGuildAdmin(request, guildId);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
  }

  try {
    const db = getRoleAdminDb();
    const docRef = db.collection("guilds").doc(guildId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ exists: false, config: null });
    }

    return NextResponse.json({
      exists: true,
      config: {
        guild_id: guildId,
        ...docSnap.data(),
      },
    });
  } catch (error: any) {
    console.error("GET role-config error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลการตั้งค่า Role Bot" },
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

    const auth = await verifyGuildAdmin(request, guildId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
    }

    const db = getRoleAdminDb();
    const docRef = db.collection("guilds").doc(guildId);

    const configToSave = {
      ...body,
      guild_id: guildId,
      updated_at: new Date().toISOString(),
    };

    await docRef.set(configToSave, { merge: true });

    return NextResponse.json({ success: true, config: configToSave });
  } catch (error: any) {
    console.error("POST role-config error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลการตั้งค่า Role Bot" },
      { status: 500 }
    );
  }
}
