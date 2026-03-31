import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal"],
        disallow: ["/api/"],
      },
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "Applebot",
          "GPTBot",
          "ChatGPT-User",
          "Claude-Web",
        ],
        allow: ["/", "/legal"],
        disallow: ["/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
