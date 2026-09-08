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

export interface BotConfig {
  name: string;
  type: string;
  headline: string;
  description: string;
  tags: readonly string[];
  features: readonly string[];
  stats: {
    users: string;
    servers: string;
  };
  inviteUrl: string;
  guideSteps: readonly GuideStep[];
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
    welcomeBotInvite:
      "https://discord.com/oauth2/authorize?client_id=1546427258711838741&permissions=8&integration_type=0&scope=bot",
    roleBotInvite:
      "https://discord.com/oauth2/authorize?client_id=1546475860478005268&permissions=8&integration_type=0&scope=bot",
    ticketBotInvite:
      "https://discord.com/oauth2/authorize?client_id=1546731977271677001&permissions=8&integration_type=0&scope=bot",
    roleBotDashboard: "https://ymm-dev.vercel.app/dashboard",
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

export const FEATURED_BOT: BotConfig = {
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
  inviteUrl: SITE_CONFIG.links.botInvite,
  guideSteps: [
    {
      step: 1,
      title: "เชิญ YMM-MUSIC เข้าเซิร์ฟเวอร์",
      detail: "กดปุ่มเพิ่มบอท เลือกเซิร์ฟเวอร์ และกด Authorize ในหน้า Discord",
    },
    {
      step: 2,
      title: "เริ่มใช้คำสั่งเพลง",
      detail: "พิมพ์คำสั่งในห้องแชตเพื่อเริ่มเล่นเพลง",
      codeSnippet: "/play",
    },
  ],
};

export const WELCOME_BOT: BotConfig = {
  name: "BOT-WELCOME",
  type: "BOT",
  headline: "บอทแสดงคนเข้าคนออก",
  description:
    "ต้อนรับสมาชิกใหม่และแจ้งเตือนสมาชิกที่ออกจากเซิร์ฟเวอร์ด้วยข้อความที่ตั้งค่าได้",
  tags: ["Welcome", "Leave Log", "Slash Command"],
  features: [
    "ตั้งค่าช่องต้อนรับและช่องแจ้งเตือนคนออกได้แยกกัน",
    "กำหนดข้อความต้อนรับและข้อความแจ้งออกได้ตามต้องการ",
    "ทดสอบการ์ดต้อนรับหรือคนออกก่อนใช้งานจริง",
    "ตรวจสอบการตั้งค่าทั้งหมดได้ด้วยคำสั่งเดียว",
  ],
  stats: {
    users: "พร้อมใช้งาน",
    servers: "เพิ่มได้ทันที",
  },
  inviteUrl: SITE_CONFIG.links.welcomeBotInvite,
  guideSteps: [
    {
      step: 1,
      title: "ตั้งค่าช่องต้อนรับสมาชิกใหม่",
      detail: "เลือกห้องที่ต้องการให้บอทส่งการ์ดต้อนรับ",
      codeSnippet: "/welcome set welcome-channel #channel",
    },
    {
      step: 2,
      title: "ตั้งค่าช่องแจ้งเตือนคนออก",
      detail: "เลือกห้องสำหรับแจ้งเตือนเมื่อสมาชิกออกจากเซิร์ฟเวอร์",
      codeSnippet: "/welcome set leave-channel #channel",
    },
    {
      step: 3,
      title: "ตั้งข้อความต้อนรับ",
      detail: "กำหนดข้อความที่จะส่งเมื่อมีสมาชิกใหม่เข้ามา",
      codeSnippet: "/welcome set welcome-message <ข้อความ>",
    },
    {
      step: 4,
      title: "ตั้งข้อความแจ้งออก",
      detail: "กำหนดข้อความที่จะส่งเมื่อสมาชิกออกจากเซิร์ฟเวอร์",
      codeSnippet: "/welcome set leave-message <ข้อความ>",
    },
    {
      step: 5,
      title: "ตรวจสอบการตั้งค่าทั้งหมด",
      detail: "ดูช่องและข้อความที่ตั้งค่าไว้ในปัจจุบัน",
      codeSnippet: "/welcome config",
    },
    {
      step: 6,
      title: "ทดสอบการ์ดก่อนเปิดใช้งาน",
      detail: "ทดสอบการ์ดต้อนรับหรือการ์ดแจ้งออกได้ทันที",
      codeSnippet: "/welcome test welcome | leave",
    },
  ],
};

export const ROLE_BOT: BotConfig = {
  name: "BOT-ROLE",
  type: "BOT",
  headline: "บอทจัดการยศและระบบสมาชิก",
  description:
    "จัดการยศในเซิร์ฟเวอร์ให้เป็นระบบ พร้อมดูแลสมาชิกและบันทึกกิจกรรมสำคัญแบบอัตโนมัติ",
  tags: ["Role Management", "Admin Log", "Automation"],
  features: [
    "ตั้งค่าระบบแจ้งเตือนเมื่อมีสมาชิกเข้าหรือออกจากเซิร์ฟเวอร์",
    "บันทึกกิจกรรมของแอดมินและการเปลี่ยนแปลงสำคัญในเซิร์ฟเวอร์",
    "ส่งข้อความอัตโนมัติเมื่อสมาชิกได้รับยศ",
    "จัดการและกำหนดค่าระบบยศได้อย่างสะดวก",
  ],
  stats: {
    users: "พร้อมใช้งาน",
    servers: "เพิ่มได้ทันที",
  },
  inviteUrl: SITE_CONFIG.links.roleBotInvite,
  guideSteps: [
    {
      step: 1,
      title: "เชิญ BOT-ROLE เข้าเซิร์ฟเวอร์",
      detail: "กดปุ่มเพิ่มบอท เลือกเซิร์ฟเวอร์ และกด Authorize สิทธิ์เปิดใช้งานในเซิร์ฟเวอร์ของคุณ",
    },
    {
      step: 2,
      title: "เข้าสู่ระบบ Web Dashboard",
      detail: "กดปุ่ม Edit Dashboard บนหน้าเว็บ เพื่อปรับแต่งสีธีม ข้อความต้อนรับ และการตั้งค่าทั้งหมด",
      codeSnippet: "https://ymm-dev.vercel.app/dashboard",
    },
    {
      step: 3,
      title: "สร้างแผงกด Emoji รับยศอัตโนมัติ",
      detail: "ผูก Emoji กับ Role บน Web Dashboard หรือใช้คำสั่ง Slash ใน Discord",
      codeSnippet: "/role-panel",
    },
    {
      step: 4,
      title: "สร้างแผงกรอกแบบฟอร์มยืนยันตัวตน",
      detail: "สร้างแผงรับยศแบบ Modal Form ให้สมาชิกกรอกข้อมูลยืนยันตัวตนก่อนรับยศ",
      codeSnippet: "/panel-form role:@สมาชิก",
    },
    {
      step: 5,
      title: "ตั้งค่าห้องแจ้งเตือน Admin Log",
      detail: "เลือกห้องข้อความสำหรับบันทึกประวัติการรับยศของสมาชิกแบบเรียลไทม์",
      codeSnippet: "/set-log channel:#log-รับยศ",
    },
    {
      step: 6,
      title: "ตั้งค่าข้อความต้อนรับส่วนตัว (DM)",
      detail: "ส่งข้อความ Embed ต้อนรับสมาชิกเข้ากล่องข้อความทันทีเมื่อรับยศสำเร็จ",
      codeSnippet: "/set-welcome",
    },
  ],
};

export const TICKET_BOT: BotConfig = {
  name: "BOT-TICKET",
  type: "BOT",
  headline: "บอท Ticket พร้อมระบบ AI และความปลอดภัยสูง",
  description:
    "จัดการ Ticket อย่างเป็นระบบ ให้ AI อ่านบทความแก้ปัญหาที่คุณตั้งค่าไว้ พร้อมบันทึก Log และปรับแต่งหน้าตา Ticket ได้เอง",
  tags: ["AI Support", "Ticket System", "High Security"],
  features: [
    "กำหนดให้ AI อ่านและใช้บทความการแก้ปัญหาที่แอดมินตั้งค่าไว้",
    "บันทึก Log ทุกครั้งเมื่อมีการปิด Ticket",
    "กำหนดสีของ Ticket และหน้าตาการใช้งานได้เอง",
    "ระบบความปลอดภัยสูง พร้อมควบคุมการเข้าถึง Ticket",
  ],
  stats: {
    users: "พร้อมใช้งาน",
    servers: "เพิ่มได้ทันที",
  },
  inviteUrl: SITE_CONFIG.links.ticketBotInvite,
  guideSteps: [],
};

export const BOT_CATALOG: readonly BotConfig[] = [
  FEATURED_BOT,
  WELCOME_BOT,
  ROLE_BOT,
  TICKET_BOT,
];

