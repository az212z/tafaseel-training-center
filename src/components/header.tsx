"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/version-link";
import { Brand } from "./brand";
import { List, X, MagnifyingGlass, Moon, Sun, ArrowUpLeft } from "./icons";

export function Header() {
  const currentPath = usePathname();
  const isV2 = currentPath === "/v2" || currentPath.startsWith("/v2/");
  const pathname = isV2 ? currentPath.slice(3) || "/" : currentPath;
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("tafaseel-theme");
      } catch {}
      const isDark = saved ? saved === "dark" : media.matches;
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      setDark(isDark);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        menuRef.current?.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tafaseel-theme", next);
    } catch {}
    setDark(!dark);
  }
  const navigation = [
    { href: "/", title: "الرئيسية" },
    { href: "/courses/", title: "الدورات التدريبية" },
    { href: "/about/", title: "عن المركز" },
    { href: "/contact/", title: "تواصل معنا" },
  ];
  return (
    <header className="site-header" data-version={isV2 ? "v2" : undefined}>
      <div className="header-inner container">
        <Link
          href="/"
          className="brand"
          aria-label="مركز تفاصيل للتدريب، الرئيسية"
          onClick={() => setOpen(false)}
        >
          <Brand />
        </Link>
        <nav
          className={`main-nav ${open ? "is-open" : ""}`}
          id="main-navigation"
          aria-label="القائمة الرئيسية"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={
                item.href === "/"
                  ? pathname === "/"
                    ? "page"
                    : undefined
                  : pathname.startsWith(item.href)
                    ? "page"
                    : undefined
              }
            >
              {item.title}
            </Link>
          ))}
          <Link
            href="/booking/"
            className="mobile-booking"
            onClick={() => setOpen(false)}
          >
            طلب حجز دورة <ArrowUpLeft size={18} />
          </Link>
        </nav>
        <div className="header-actions">
          <Link
            href="/courses/#course-search"
            className="icon-button search-link"
            aria-label="البحث عن دورة"
            onClick={() => setOpen(false)}
          >
            <MagnifyingGlass size={21} />
          </Link>
          <button
            className="icon-button theme-button"
            onClick={toggleTheme}
            aria-label={dark ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن"}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link
            href="/booking/"
            className="header-booking"
            onClick={() => setOpen(false)}
          >
            احجز دورتك <ArrowUpLeft size={19} />
          </Link>
          <button
            ref={menuRef}
            className="icon-button menu-button"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
      </div>
    </header>
  );
}
