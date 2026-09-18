"use client";

import { usePathname } from "next/navigation";

export function DesignerCredit() {
  const pathname = usePathname();
  if (pathname !== "/v2" && !pathname.startsWith("/v2/")) return null;

  return (
    <div className="container footer-credit" dir="ltr" lang="en">
      <span>Designed by</span>
      <a
        className="footer-designer-link"
        href="https://wa.me/966505989304"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="التواصل مع Ali عبر واتساب"
      >
        Ali
      </a>
    </div>
  );
}
