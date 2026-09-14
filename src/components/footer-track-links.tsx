"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/version-link";
import { tracks } from "@/lib/courses";
import { programs } from "@/lib/v2-courses";

export function FooterTrackLinks() {
  const pathname = usePathname();
  const items =
    pathname === "/v2" || pathname.startsWith("/v2/") ? programs : tracks;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/tracks/${item.id}/`}>{item.title}</Link>
        </li>
      ))}
    </ul>
  );
}
