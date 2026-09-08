import { NextResponse } from "next/server";
import { getTicketAdminDb, verifyGuildAdmin } from "@/lib/serverFirestore";
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
    const snapshot = await db
      .collection("guilds")
      .doc(guildId)
      .collection("knowledge_base")
      .orderBy("created_at", "desc")
      .limit(50)
      .get();

    const articles = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "ไม่มีหัวข้อ",
        category: data.category || "general",
        content: data.content || "",
        image_url: data.image_url || "",
        tags: data.tags || [],
        created_at: data.created_at?.toMillis ? data.created_at.toMillis() : (data.created_at || null),
      };
    });

    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error("GET ticket-knowledge error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการโหลดคลังความรู้" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guild_id, title, content, image_url, tags } = body;

    if (!guild_id) {
      return NextResponse.json({ error: "Missing guild_id" }, { status: 400 });
    }
    if (!title || !content) {
      return NextResponse.json({ error: "กรุณากรอกหัวข้อและเนื้อหาของบทความ" }, { status: 400 });
    }

    const auth = await verifyGuildAdmin(request, guild_id, "ticket");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
    }

    const tagsArray = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
      ? tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const db = getTicketAdminDb();
    const newDoc = await db
      .collection("guilds")
      .doc(guild_id)
      .collection("knowledge_base")
      .add({
        title: title.trim(),
        category: "general",
        content: content.trim(),
        image_url: image_url?.trim() || null,
        tags: tagsArray,
        created_by: auth.profile?.username || "Web Admin",
        created_at: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true, id: newDoc.id });
  } catch (error: any) {
    console.error("POST ticket-knowledge error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการเพิ่มบทความ" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get("guild_id");
    const articleId = searchParams.get("article_id");

    if (!guildId || !articleId) {
      return NextResponse.json({ error: "Missing guild_id or article_id" }, { status: 400 });
    }

    const auth = await verifyGuildAdmin(request, guildId, "ticket");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 403 });
    }

    const db = getTicketAdminDb();
    await db
      .collection("guilds")
      .doc(guildId)
      .collection("knowledge_base")
      .doc(articleId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE ticket-knowledge error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการลบบทความ" },
      { status: 500 }
    );
  }
}
