import { SectionHeading } from "@/components/ui/SectionHeading";
import { GradientText } from "@/components/ui/GradientText";
import { TestimonialSubmit } from "@/components/sections/TestimonialSubmit";
import {
  ReviewsMarquee,
  type ReviewItem,
} from "@/components/sections/ReviewsMarquee";

/**
 * نظرات — visitor comments about the website, rendered as an instrumented
 * infinite horizontal marquee (LEFT → RIGHT) by ReviewsMarquee. Cards are
 * read-only — no likes, no reactions. Below the marquee sits the feedback
 * submission area.
 */

const comments: ReviewItem[] = [
  {
    id: "sara-mohammadi",
    name: "سارا محمدی",
    role: "مدیر محصول",
    date: "دوشنبه، ۲۴ فروردین",
    text: "طراحی وب‌سایت واقعاً حرفه‌ای و دقیقه. هم‌چیزی سر جای خودشه و سرعت بارگذاری صفحات عالیه. تجربه‌ی کاربری از هر نظر روان و لذت‌بخشه.",
  },
  {
    id: "amir-rezaei",
    name: "امیر رضایی",
    role: "بنیان‌گذار استارتاپ",
    date: "پنجشنبه، ۱۲ اردیبهشت",
    text: "ساختار منو و چینش محتوا به‌قدری منظمه که در چند ثانیه‌ی اول همه‌چیز رو متوجه شدم. همین دقت و نظم باعث شد برای پروژه‌ی خودم بهشون اعتماد کنم.",
  },
  {
    id: "negar-karimi",
    name: "نگار کریمی",
    role: "طراح ارشد رابط کاربری",
    date: "سه‌شنبه، ۳۰ اردیبهشت",
    text: "به‌عنوان یک طراح، به جزئیات تایپوگرافی و فاصله‌ها خیلی دقت می‌کنم — و این سایت دقیقاً همون سطح از وسواس رو نشون می‌ده. واقعاً قابل تحسینه.",
  },
  {
    id: "hossein-abdollahi",
    name: "حسین عبدالهی",
    role: "توسعه‌دهنده‌ی فرانت‌اند",
    date: "شنبه، ۱۰ خرداد",
    text: "کد با کیفیت و ساختار منظم، همراه با جزئیات ریز اما تأثیرگذار. تحویل به‌موقع و ارتباط شفاف — دقیقاً چیزی که برای یک همکاری بلندمدت لازمه.",
  },
  {
    id: "maryam-ahmadi",
    name: "مریم احمدی",
    role: "مدیر برندینگ",
    date: "یکشنبه، ۲۵ خرداد",
    text: "حس و حال سایت کاملاً با هویت برند ما هماهنگ شد. تیم OMID Studio به جای کپی از قالب‌های آماده، یک هویت بصری اختصاصی برای ما ساخت.",
  },
  {
    id: "ali-mousavi",
    name: "علی موسوی",
    role: "کارآفرین",
    date: "چهارشنبه، ۵ تیر",
    text: "از ایده تا محصول نهایی، مسیر کاملاً شفاف و حرفه‌ای طی شد. خروجی کار هم از نظر فنی و هم از نظر بصری فراتر از انتظارم بود.",
  },
];

export function Testimonials() {
  return (
    <section
      className="relative overflow-hidden py-28 md:py-40"
      aria-label="نظرات"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <div className="container-site">
        <SectionHeading
          label="۰۶ — نظرات"
          title={
            <>
              آنچه همکاران و بازدیدکنندگان <GradientText>می‌گویند.</GradientText>
            </>
          }
          aside={
            <p className="max-w-sm text-base leading-relaxed text-muted">
              بازخورد واقعی درباره‌ی تجربه‌ی کار با OMID Studio و همین
              وب‌سایت.
            </p>
          }
        />
      </div>

      <ReviewsMarquee reviews={comments} />

      <div className="container-site">
        <TestimonialSubmit />
      </div>
    </section>
  );
}
