import type { MetadataRoute } from "next";
import { pagedProjects } from "@/content";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/work`, priority: 0.9 },
    ...pagedProjects.map((p) => ({
      url: `${SITE_URL}/work/${p.slug}`,
      priority: p.group === "archive" ? 0.4 : 0.8,
    })),
    { url: `${SITE_URL}/resume`, priority: 0.9 },
    { url: `${SITE_URL}/about`, priority: 0.6 },
    { url: `${SITE_URL}/proof`, priority: 0.6 },
    { url: `${SITE_URL}/case`, priority: 0.5 },
    { url: `${SITE_URL}/case/ar`, priority: 0.4 },
    { url: `${SITE_URL}/ar/marker`, priority: 0.4 },
    { url: `${SITE_URL}/ar/marker/card`, priority: 0.3 },
  ];
}
