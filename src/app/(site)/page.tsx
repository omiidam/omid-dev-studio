import type { Metadata } from "next";
import { site } from "@/data/site";
import { Hero } from "@/components/sections/Hero";
import { Introduction } from "@/components/sections/Introduction";
import { Services } from "@/components/sections/Services";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { Philosophy } from "@/components/sections/Philosophy";
import { Process } from "@/components/sections/Process";
import { Technology } from "@/components/sections/Technology";
import { Testimonials } from "@/components/sections/Testimonials";
import { Contact } from "@/components/sections/Contact";

export const metadata: Metadata = {
  title: "طراحی و توسعه وب، وب‌اپلیکیشن و محصولات دیجیتال — OMID Studio",
  description: site.description,
  alternates: { canonical: site.url },
};

export default function Home() {
  return (
    <>
      <Hero />
      <Introduction />
      <Services />
      <SelectedWork />
      <Philosophy />
      <Process />
      <Technology />
      <Testimonials />
      <Contact />
    </>
  );
}