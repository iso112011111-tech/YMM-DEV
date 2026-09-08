import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/discordAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const sessionCookie = cookieHeader
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([name]) => name === SESSION_COOKIE)?.[1];
    const profile = readSession(sessionCookie);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: กรุณาเข้าสู่ระบบ Discord ก่อนอัปโหลดรูปภาพ" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
    }

    // Validate MIME type
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF) เท่านั้น" },
        { status: 400 }
      );
    }

    // Validate size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "ขนาดไฟล์ต้องไม่เกิน 10MB" },
        { status: 400 }
      );
    }

    // Upload to Catbox
    const uploadData = new FormData();
    uploadData.append("reqtype", "fileupload");
    uploadData.append("fileToUpload", file, file.name || "uploaded_image.png");

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: uploadData,
    });

    if (!response.ok) {
      throw new Error(`Upload server responded with status: ${response.status}`);
    }

    const imageUrl = (await response.text()).trim();

    if (!imageUrl.startsWith("http")) {
      throw new Error(`Upload failed: ${imageUrl}`);
    }

    return NextResponse.json({
      success: true,
      url: imageUrl,
    });
  } catch (error: any) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" },
      { status: 500 }
    );
  }
}
