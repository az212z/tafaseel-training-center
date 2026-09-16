"use client";
import { usePathname } from "next/navigation";
import Link from "@/components/version-link";
export function GalleryFooterLink() {
  const pathname = usePathname();
  if (pathname !== "/v2" && !pathname.startsWith("/v2/")) return null;
  return (
    <li>
      <Link href="/gallery/">صور المركز</Link>
    </li>
  );
}
