import Image from "@/components/site-image";

// The original composition is preserved; CSS frames hide only the outer whitespace.
function Artwork() {
  return (
    <Image
      src="/brand/logo-original.webp"
      alt=""
      width={1280}
      height={1136}
      preload
    />
  );
}
export function Brand({ full = false }: { full?: boolean }) {
  return full ? (
    <div
      className="brand-full"
      role="img"
      aria-label="شعار مركز تفاصيل للتدريب"
    >
      <Artwork />
    </div>
  ) : (
    <span className="brand-lockup" role="img" aria-label="مركز تفاصيل للتدريب">
      <span className="brand-emblem">
        <Artwork />
      </span>
      <span className="brand-wordmark">
        <Artwork />
      </span>
    </span>
  );
}
