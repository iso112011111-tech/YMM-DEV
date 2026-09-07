export interface FeatureItem {
  icon: string;
  title: string;
  text: string;
}

export interface GuideStep {
  step: number;
  title: string;
  detail: string;
  codeSnippet?: string;
}

export const SITE_CONFIG = {
  name: "YMM-DEV",
  tagline: "Discord Bot Marketplace",
  title: "YMM-DEV | รวมบอท Discord คุณภาพ ใช้งานง่ายและเสถียร",
  description:
    "YMM-DEV แหล่งรวมบอท Discord คุณภาพสูงสำหรับคอมมูนิตี้ของคุณ เสถียร ปลอดภัย 100% พร้อมทีมงานดูแลตลอด 24 ชั่วโมง",
  links: {
    discordSupport: "https://discord.gg/D68qNtzX3x",
    botInvite:
      "https://discord.com/oauth2/authorize?client_id=1546202260558848010&permissions=8&integration_type=0&scope=bot",
  },
} as const;

export const FEATURES: readonly FeatureItem[] = [
  {
    icon: "◇",
    title: "ปลอดภัย 100%",
    text: "โค้ดคุณภาพ ตรวจสอบความปลอดภัยเข้มงวด ใช้งานได้อย่างมั่นใจ",
  },
  {
    icon: "ϟ",
    title: "ใช้งานง่าย",
    text: "ติดตั้งไม่ยุ่งยาก เพียงไม่กี่คลิกก็พร้อมทำงานได้ทันที",
  },
  {
    icon: "♧",
    title: "ซัพพอร์ตตลอด 24 ชม.",
    text: "มีทีมงานคอยดูแล พร้อมช่วยเหลือและแก้ปัญหาอย่างรวดเร็ว",
  },
  {
    icon: "★",
    title: "อัปเดตสม่ำเสมอ",
    text: "พัฒนาฟีเจอร์ใหม่อย่างต่อเนื่อง และปรับปรุงประสิทธิภาพสม่ำเสมอ",
  },
];

export const FEATURED_BOT = {
  name: "YMM-MUSIC",
  type: "BOT",
  headline: "บอทฟังเพลงครบจบในตัวเดียว",
  description:
    "ให้คุณและสมาชิกในเซิร์ฟเวอร์ ฟังเพลงได้อย่างสะดวก พร้อมฟีเจอร์ที่ใช้งานง่าย คุณภาพเสียงระดับพรีเมียม",
  tags: ["Music", "Slash Command", "24/7 High Uptime"],
  features: [
    "ฟังเพลงจาก YouTube / Spotify / SoundCloud",
    "ควบคุมเพลงด้วยคำสั่ง /ปุ่มกด (Interactive Components)",
    "รองรับระบบคิวเพลง เพลย์ลิสต์ส่วนตัว และโหมดวนซ้ำ",
    "ทำงานได้ตลอด 24 ชั่วโมง เสถียร ไม่กระตุก",
  ],
  stats: {
    users: "12,458+",
    servers: "8,721+",
  },
} as const;

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    step: 1,
    title: "กด “เพิ่มบอทในเซิร์ฟเวอร์”",
    detail: "ระบบจะพาไปยังหน้า Discord Authorization เพื่อยืนยันสิทธิ์",
  },
  {
    step: 2,
    title: "เลือกเซิร์ฟเวอร์ที่ต้องการ",
    detail: "คุณต้องมีสิทธิ์ Manage Server หรือเป็นเจ้าของเซิร์ฟเวอร์นั้น",
  },
  {
    step: 3,
    title: "ตรวจสอบสิทธิ์แล้วกด Authorize",
    detail: "อนุญาตสิทธิ์ที่จำเป็นเพื่อให้บอทสามารถเข้าร่วมและเล่นเสียงได้",
  },
  {
    step: 4,
    title: "เริ่มใช้คำสั่งได้ทันที",
    detail: "พิมพ์คำสั่งในห้องแชตเพื่อเริ่มเล่นเพลงและสัมผัสประสบการณ์ทันที",
    codeSnippet: "/play",
  },
];
