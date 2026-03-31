import type { MetadataRoute } from "next";
import { absoluteUrl, PUBLIC_ROUTE_COPY } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl(PUBLIC_ROUTE_COPY.home.path),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl(PUBLIC_ROUTE_COPY.legal.path),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
