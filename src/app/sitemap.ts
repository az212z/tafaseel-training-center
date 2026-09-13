import type { MetadataRoute } from "next";
import { courses, tracks } from "@/lib/courses";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!site) return [];
  return [
    "",
    "/courses",
    "/about",
    "/contact",
    "/faq",
    "/booking",
    "/privacy",
    "/booking-policy",
    ...courses.map((c) => `/courses/${c.slug}`),
    ...tracks.map((t) => `/tracks/${t.id}`),
  ].map((path) => ({ url: `${site}${path}/` }));
}
