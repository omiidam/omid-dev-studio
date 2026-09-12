import type { Metadata } from "next";
import { site } from "@/data/site";
import { Process } from "@/components/sections/Process";

export const metadata: Metadata = {
  title: "فرآیند",
  description:
    "فرآیند کاری OMID Studio در پنج گام — شناخت، طراحی، توسعه، بهینه‌سازی و انتشار.",
  alternates: { canonical: `${site.url}/process` },
};

export default function ProcessPage() {
  return (
    <div className="relative overflow-x-clip">
      <Process />
    </div>
  );
}