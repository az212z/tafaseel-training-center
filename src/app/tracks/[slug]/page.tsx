import type { Metadata } from "next";
import Image from "@/components/site-image";
import { notFound } from "next/navigation";
import { tracks, getTrack } from "@/lib/courses";
import { Catalog } from "@/components/catalog";
import { Breadcrumbs, ContactBanner } from "@/components/ui";
export const dynamicParams = false;
export function generateStaticParams() {
  return tracks.map((track) => ({ slug: track.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const track = getTrack((await params).slug);
  return { title: track?.title, description: track?.description };
}
export default async function TrackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const track = getTrack((await params).slug);
  if (!track) notFound();
  return (
    <>
      <div className="container">
        <Breadcrumbs
          items={[
            { title: "الدورات", href: "/courses/" },
            { title: track.title },
          ]}
        />
        <header className="track-hero">
          <div>
            <p className="eyebrow">{track.label}</p>
            <h1>{track.title}</h1>
            <p>{track.description}</p>
          </div>
          <Image
            src={`/images/${track.image}`}
            alt={track.title}
            width={600}
            height={340}
            priority
          />
        </header>
        <section
          className="catalog-section"
          aria-label={`دورات ${track.title}`}
        >
          <Catalog track={track.id} />
        </section>
      </div>
      <ContactBanner />
    </>
  );
}
