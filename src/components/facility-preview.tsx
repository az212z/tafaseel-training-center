import Link from "@/components/version-link";
import Image from "@/components/site-image";
import { facilityPhotos, facilityImage } from "@/lib/facility-photos";
import { ArrowUpLeft, ArrowLeft } from "./icons";

export function FacilityPreview() {
  const selected = ["main-training-room", "reception", "lounge"].map((id) =>
    facilityPhotos.find((photo) => photo.id === id)!,
  );
  return (
    <section
      className="section container facility-preview"
      aria-labelledby="facility-preview-heading"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">من داخل مركز تفاصيل</p>
          <h2 id="facility-preview-heading">تعرّف على المكان عن قرب.</h2>
          <p>جولة مصوّرة في قاعاتنا ومساحات الاستقبال والجلسات.</p>
        </div>
        <Link href="/gallery/" className="text-link">
          شاهد صور المركز <ArrowLeft size={19} />
        </Link>
      </div>
      <div className="facility-preview-grid">
        {selected.map((photo, index) => (
          <Link
            href={`/gallery/#${photo.id}`}
            key={photo.id}
            className="facility-preview-photo"
            aria-label={`شاهد ${photo.title} في معرض المركز`}
          >
            <Image
              src={facilityImage(photo.id, index > 0)}
              alt={photo.alt}
              fill
              sizes={
                index === 0
                  ? "(max-width: 760px) 100vw, 60vw"
                  : "(max-width: 760px) 50vw, 35vw"
              }
            />
            <span>
              <span>{photo.title}</span>
              <ArrowUpLeft size={22} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
