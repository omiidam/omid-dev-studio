import type { MetadataRoute } from "next";
import { projects } from "@/data/projects";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  // Build time is the real lastModified of a statically generated page.
  const built = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: built, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/services`, lastModified: built, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/work`, lastModified: built, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/process`, lastModified: built, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, lastModified: built, changeFrequency: "yearly", priority: 0.8 },
  ];

  const projectPages: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${base}/work/${project.slug}`,
    lastModified: built,
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  return [...staticPages, ...projectPages];
}