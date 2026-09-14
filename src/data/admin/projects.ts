import type {
  ManagedProject,
  ManagedProjectInput,
} from "@/lib/managed-projects";

/**
 * TEMPORARY Phase-1 demo data for the Project Management Panel.
 *
 * This file is the ONLY place temporary panel data exists — deliberately
 * isolated so the Phase 2 backend replaces `fetchManagedProjects` with real
 * persistence (or a `fetch("/api/admin/managed-projects")` call) without any
 * UI rewrite. Consumers never import this data directly; they go through
 * `managed-project-source.ts`.
 *
 * These are fictional demo records, not real client data.
 */

const seed: ManagedProject[] = [
  {
    id: "demo-northwind",
    name: "تحلیل‌گر نورث‌ویند",
    client: "شرکت داده‌پردازان نوین",
    type: "dashboard",
    description:
      "داشبورد تحلیلی بلادرنگ برای تیم‌های محصول؛ شامل شبکه‌ی ماژولار ویجت‌ها، تجمیع سمت سرور و نمای کندوکاو روی هر معیار.",
    status: "in_progress",
    progress: 65,
    startDate: "2026-07-01",
    deadline: "2026-10-15",
    budget: 12000,
    payment: "advance",
    demoUrl: "https://demo.omidstudio.example/northwind",
    githubUrl: "https://github.com/omiidam/omid-dev-studio",
    technologies: ["Next.js", "TypeScript", "PostgreSQL", "Recharts"],
    notes: "دسترسی سرور تست از طریق فایل env مشتری ارسال شد؛ احراز هویت نقش‌محور در هفته‌ی بعد.",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-28T14:30:00.000Z",
    timeline: [
      {
        id: "t1",
        date: "2026-07-01",
        title: "شروع پروژه",
        description: "امضای قرارداد و تحویل نیازمندی‌های اولیه.",
      },
      {
        id: "t2",
        date: "2026-07-14",
        title: "تأیید طراحی رابط",
        description: "چیدمان داشبورد و سیستم رنگ تأیید شد.",
      },
      {
        id: "t3",
        date: "2026-08-20",
        title: "تحویل نسخه‌ی آزمایشی",
        description: "نسخه‌ی اول داشبورد در اختیار مشتری قرار گرفت.",
      },
    ],
    milestones: [
      { id: "m1", title: "پایان لایه‌ی داده", dueDate: "2026-08-01", done: true },
      { id: "m2", title: "تکمیل داشبورد اصلی", dueDate: "2026-09-10", done: true },
      { id: "m3", title: "احراز هویت نقش‌محور", dueDate: "2026-09-25", done: false },
      { id: "m4", title: "تحویل نهایی", dueDate: "2026-10-15", done: false },
    ],
    activity: [
      {
        id: "a1",
        at: "2026-08-28T14:30:00.000Z",
        text: "ویجت‌های تحلیلی به نسخه‌ی آزمایشی اضافه شد.",
      },
      {
        id: "a2",
        at: "2026-08-21T10:00:00.000Z",
        text: "جلسه‌ی بازخورد با مشتری برگزار شد.",
      },
    ],
    files: [
      {
        id: "f1",
        name: "northwind-scope.pdf",
        size: "۸۴۰ کیلوبایت",
        kind: "PDF",
        updatedAt: "2026-07-02",
      },
      {
        id: "f2",
        name: "dashboard-ui-v2.fig",
        size: "۱۲ مگابایت",
        kind: "Figma",
        updatedAt: "2026-07-14",
      },
    ],
  },
  {
    id: "demo-pulse",
    name: "فروشگاه پالس",
    client: "برند سبک‌زندگی پالس",
    type: "ecommerce",
    description:
      "فروشگاه اینترنتی برندمحور با تسویه‌حساب دوسطحی، مدیریت موجودی و کاتالوگ کش‌شده در لبه.",
    status: "in_progress",
    progress: 40,
    startDate: "2026-08-10",
    deadline: "2026-11-20",
    budget: 8500,
    payment: "partial",
    demoUrl: "",
    githubUrl: "",
    technologies: ["Next.js", "Stripe", "PostgreSQL", "Tailwind CSS"],
    notes: "عکاسی محصول تا ۲۰ شهریور؛ وابسته به تحویل تصاویر مشتری.",
    createdAt: "2026-08-10T08:00:00.000Z",
    updatedAt: "2026-09-01T11:00:00.000Z",
    timeline: [
      {
        id: "t1",
        date: "2026-08-10",
        title: "شروع پروژه",
        description: "توافق اولیه و جمع‌آوری محتوای محصولات.",
      },
      {
        id: "t2",
        date: "2026-08-30",
        title: "اتصال درگاه پرداخت",
        description: "جریان تسویه‌حساب تستی سبز شد.",
      },
    ],
    milestones: [
      { id: "m1", title: "کاتالوگ و سبد خرید", dueDate: "2026-09-05", done: true },
      { id: "m2", title: "پنل مدیریت موجودی", dueDate: "2026-10-01", done: false },
      { id: "m3", title: "راه‌اندازی نهایی", dueDate: "2026-11-20", done: false },
    ],
    activity: [
      {
        id: "a1",
        at: "2026-09-01T11:00:00.000Z",
        text: "تسویه‌ی بخش دوم مبلغ پروژه ثبت شد.",
      },
    ],
    files: [
      {
        id: "f1",
        name: "pulse-brand-guidelines.pdf",
        size: "۲.۱ مگابایت",
        kind: "PDF",
        updatedAt: "2026-08-12",
      },
    ],
  },
  {
    id: "demo-meridian",
    name: "کنسول مریدین",
    client: "گروه خدمات مریدین",
    type: "saas",
    description:
      "کنسول عملیات ابری برای هماهنگی تیم‌های میدانی؛ برد یکپارچه، وضعیت زنده و تعامل‌های مبتنی بر کیبورد.",
    status: "completed",
    progress: 100,
    startDate: "2026-02-01",
    deadline: "2026-06-15",
    budget: 18000,
    payment: "paid",
    demoUrl: "https://meridian.example.com",
    githubUrl: "",
    technologies: ["React", "TypeScript", "Supabase", "Node.js"],
    notes: "پروژه‌ی مرجع برای ارائه به مشتریان مشابه؛ سورس در مخزن اختصاصی مشتری.",
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-06-15T16:00:00.000Z",
    timeline: [
      { id: "t1", date: "2026-02-01", title: "شروع پروژه", description: "تحلیل گردش‌کار عملیاتی." },
      { id: "t2", date: "2026-04-10", title: "نسخه‌ی بتا", description: "پایلوت با دو تیم میدانی." },
      { id: "t3", date: "2026-06-15", title: "تحویل نهایی", description: "راه‌اندازی کامل و آموزش اپراتورها." },
    ],
    milestones: [
      { id: "m1", title: "برد هماهنگی", dueDate: "2026-03-20", done: true },
      { id: "m2", title: "بتای پایلوت", dueDate: "2026-04-10", done: true },
      { id: "m3", title: "تحویل نهایی", dueDate: "2026-06-15", done: true },
    ],
    activity: [
      {
        id: "a1",
        at: "2026-06-15T16:00:00.000Z",
        text: "تسویه‌ی نهایی انجام و پروژه بسته شد.",
      },
    ],
    files: [
      {
        id: "f1",
        name: "meridian-handover.pdf",
        size: "۱.۴ مگابایت",
        kind: "PDF",
        updatedAt: "2026-06-15",
      },
      {
        id: "f2",
        name: "operator-training.mp4",
        size: "۹۶ مگابایت",
        kind: "ویدیو",
        updatedAt: "2026-06-10",
      },
    ],
  },
  {
    id: "demo-fieldnote",
    name: "سایت فیلدنت",
    client: "استارتاپ فیلدنت",
    type: "website",
    description:
      "صفحه‌ی معرفی محصول با ساختار روایی تک‌اسکرول و هماهنگی اسکرول ظریف.",
    status: "negotiating",
    progress: 0,
    startDate: "",
    deadline: "",
    budget: 3500,
    payment: "unpaid",
    demoUrl: "",
    githubUrl: "",
    technologies: ["Next.js", "Framer Motion"],
    notes: "منتظر بازخورد برآورد نهایی؛ بودجه‌ی پیشنهادی هنوز تأیید نشده.",
    createdAt: "2026-09-05T09:00:00.000Z",
    updatedAt: "2026-09-05T09:00:00.000Z",
    timeline: [],
    milestones: [],
    activity: [
      {
        id: "a1",
        at: "2026-09-05T09:00:00.000Z",
        text: "درخواست اولیه‌ی مشتری ثبت شد.",
      },
    ],
    files: [],
  },
  {
    id: "demo-atlas",
    name: "رزرو اطلس",
    client: "مجموعه‌ی رفاهی اطلس",
    type: "webapp",
    description:
      "پلتفرم رزرو فول‌استک با مدیریت اتمیک ظرفیت، پرداخت وب‌هوک‌محور و داشبورد مالکان.",
    status: "pending",
    progress: 0,
    startDate: "2026-10-01",
    deadline: "2027-01-15",
    budget: 15000,
    payment: "advance",
    demoUrl: "",
    githubUrl: "",
    technologies: ["Next.js", "Node.js", "PostgreSQL", "Stripe"],
    notes: "شروع پس از تعطیلات؛ جلسه‌ی کیک‌آف برنامه‌ریزی شده است.",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-02T08:00:00.000Z",
    timeline: [],
    milestones: [
      { id: "m1", title: "جلسه‌ی کیک‌آف", dueDate: "2026-10-01", done: false },
    ],
    activity: [
      {
        id: "a1",
        at: "2026-09-02T08:00:00.000Z",
        text: "پیش‌پرداخت دریافت و پروژه در صف شروع قرار گرفت.",
      },
    ],
    files: [],
  },
  {
    id: "demo-legacy-crm",
    name: "بازطراحی CRM قدیمی",
    client: "بیمه‌ی پارسیان (پروژه‌ی قدیمی)",
    type: "other",
    description:
      "به‌روزرسانی رابط پنل داخلی؛ در میانه‌ی راه با تغییر اولویت‌های مشتری متوقف شد.",
    status: "halted",
    progress: 30,
    startDate: "2025-11-01",
    deadline: "2026-03-01",
    budget: 6000,
    payment: "partial",
    demoUrl: "",
    githubUrl: "",
    technologies: ["React", "Bootstrap"],
    notes: "احتمال ازسرگیری در فصل بعد؛ مستندات کامل نگه داشته شده.",
    createdAt: "2025-11-01T09:00:00.000Z",
    updatedAt: "2026-01-20T10:00:00.000Z",
    timeline: [
      { id: "t1", date: "2025-11-01", title: "شروع پروژه", description: "" },
      { id: "t2", date: "2026-01-20", title: "توقف موقت", description: "به درخواست مشتری." },
    ],
    milestones: [
      { id: "m1", title: "مستندسازی وضع موجود", dueDate: "2025-12-01", done: true },
      { id: "m2", title: "بازطراحی رابط", dueDate: "2026-03-01", done: false },
    ],
    activity: [
      { id: "a1", at: "2026-01-20T10:00:00.000Z", text: "پروژه موقتاً متوقف شد." },
    ],
    files: [],
  },
];

const emptyProject = (): ManagedProjectInput => ({
  name: "",
  client: "",
  type: "website",
  description: "",
  status: "negotiating",
  progress: 0,
  startDate: "",
  deadline: "",
  budget: 0,
  payment: "unpaid",
  demoUrl: "",
  githubUrl: "",
  technologies: [],
  notes: "",
});

export { seed as managedProjectSeed, emptyProject };
