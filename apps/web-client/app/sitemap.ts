import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { VILLES } from "@/lib/recherche";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return routing.locales.flatMap((l) => [
    { url: `${base}/${l}`, changeFrequency: "daily" as const, priority: 1 },
    ...VILLES.map((v) => ({
      url: `${base}/${l}/location-voiture/${v.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ]);
}
