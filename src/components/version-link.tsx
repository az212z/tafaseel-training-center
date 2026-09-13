"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

// Keep a visitor's whole journey in the selected design, including query strings.
export default function Link({
  href,
  ...props
}: ComponentProps<typeof NextLink>) {
  const pathname = usePathname();
  const isV2 = pathname === "/v2" || pathname.startsWith("/v2/");
  function versionPath(path: string) {
    return isV2 &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      path !== "/v2" &&
      !/^\/v2[/?#]/.test(path)
      ? `/v2${path}`
      : path;
  }
  const resolved =
    typeof href === "string"
      ? versionPath(href)
      : {
          ...href,
          pathname: href.pathname ? versionPath(href.pathname) : href.pathname,
        };
  return <NextLink {...props} href={resolved} />;
}
