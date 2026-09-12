import type { MetadataRoute } from "next";
import { site } from "@/data/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API responses are dynamic/private — never crawl them. /offline is
        // a PWA fallback shell with no standalone value for search engines.
        // /admin is the authenticated management area — never index it.
        disallow: ["/api/", "/offline", "/admin/"],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}