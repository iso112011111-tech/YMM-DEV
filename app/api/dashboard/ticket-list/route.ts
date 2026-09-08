import { NextResponse } from "next/server";
import { getTicketAdminDb, verifyGuildAdmin } from "@/lib/serverFirestore";

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
    const db = getTicketAdminDb();
    const snapshot = await db
      .collection("guilds")
      .doc(guildId)
      .collection("tickets")
      .orderBy("created_at", "desc")
      .limit(20)
      .get();

    const tickets = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ticket_number: data.ticket_number || 0,
        subject: data.subject || "ไม่มีหัวข้อ",
        author_tag: data.author_tag || "User",
        status: data.status || "open",
        priority: data.priority || "normal",
        csat_score: data.csat_score ?? null,
        created_at: data.created_at?.toMillis ? data.created_at.toMillis() : (data.created_at || null),
      };
    });

    return NextResponse.json({ tickets });
  } catch (error: any) {
    console.error("GET ticket-list error:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาดในการโหลดรายการตั๋ว" },
      { status: 500 }
    );
  }
}
