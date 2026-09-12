import type { Metadata } from "next";
import { site } from "@/data/site";
import { Services } from "@/components/sections/Services";

export const metadata: Metadata = {
  title: "خدمات",
  description:
    "طراحی و توسعه وب‌سایت، وب‌اپلیکیشن، توسعه فول‌استک و مهندسی رابط کاربری — مجموعه‌ای متمرکز از خدمات OMID Studio.",
  alternates: { canonical: `${site.url}/services` },
};

export default function ServicesPage() {
  return (
    <div className="relative overflow-x-clip">
      <Services />
    </div>
  );
}