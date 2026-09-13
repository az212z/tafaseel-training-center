import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { assetPath } from "@/lib/site";
import "./globals.css";

const plex = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2",
      weight: "600",
    },
  ],
  variable: "--font-arabic",
  display: "swap",
});
const title = "مركز تفاصيل للتدريب";
export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: {
    default: `${title} | بداية مدروسة لطموحك`,
    template: `%s | ${title}`,
  },
  description:
    "دورات القدرات والتحصيلي والكفايات التعليمية واللغة الإنجليزية والتطوير والفنون. اكتشف دورتك وتواصل مع مركز تفاصيل لحجزها عبر واتساب.",
  robots: {
    index: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    follow: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  },
  openGraph: {
    title,
    description: "بداية مدروسة لطموحك. اكتشف المسار التدريبي المناسب لك.",
    locale: "ar_SA",
    type: "website",
    ...(process.env.NEXT_PUBLIC_SITE_URL
      ? {
          images: [
            `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/brand/logo-original.jpg`,
          ],
        }
      : {}),
  },
  icons: { icon: assetPath("/brand/logo-original.webp") },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#365f73",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      data-scroll-behavior="smooth"
      dir="rtl"
      className={plex.variable}
      style={
        {
          "--brand-logo": `url("${assetPath("/brand/logo-original.webp")}")`,
          "--brand-pattern-blue": `url("${assetPath("/brand/pattern-blue.webp")}")`,
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          as="image"
          href={assetPath("/brand/logo-original.webp")}
          fetchPriority="high"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tafaseel-theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          تجاوز إلى المحتوى
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
