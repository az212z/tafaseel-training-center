"use client";

import { useEffect, useRef, useState } from "react";
import Image from "@/components/site-image";
import {
  facilityCategories,
  facilityPhotos,
  facilityImage,
  type FacilityCategory,
} from "@/lib/facility-photos";
import { arabicNumber } from "@/lib/courses";
import { ArrowLeft, X, ArrowUpLeft } from "./icons";

export function FacilityGallery() {
  const [category, setCategory] = useState<FacilityCategory>("all");
  const [active, setActive] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const visible = facilityPhotos.filter(
    (photo) => category === "all" || photo.category === category,
  );
  const photo = active === null ? null : facilityPhotos[active];

  useEffect(() => {
    if (active === null) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [active]);

  function openPhoto(id: string, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setActive(facilityPhotos.findIndex((item) => item.id === id));
    dialogRef.current?.showModal();
  }
  function move(direction: number) {
    setActive((current) =>
      current === null
        ? null
        : (current + direction + facilityPhotos.length) % facilityPhotos.length,
    );
  }
  function closePhoto() {
    dialogRef.current?.close();
  }

  return (
    <>
      <div className="facility-filter-row" aria-label="تصفية صور المركز">
        {facilityCategories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? "selected" : ""}
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <p className="facility-result-count" role="status" aria-live="polite">
        {visible.length === 2
          ? "صورتان"
          : `${arabicNumber(visible.length)} صور`}{" "}
        · اضغط على الصورة لعرضها كاملة
      </p>
      <div className="facility-gallery-grid">
        {visible.map((item) => (
          <figure className="facility-card" id={item.id} key={item.id}>
            <button
              type="button"
              className="facility-image-button"
              onClick={(event) => openPhoto(item.id, event.currentTarget)}
              aria-label={`تكبير الصورة: ${item.title}`}
            >
              <Image
                src={facilityImage(item.id, true)}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
              />
              <span className="facility-expand" aria-hidden="true">
                <ArrowUpLeft size={23} />
              </span>
            </button>
            <figcaption>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <dialog
        ref={dialogRef}
        className="facility-lightbox"
        aria-label="عرض صور مركز تفاصيل"
        onClose={() => {
          setActive(null);
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePhoto();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        <div className="facility-lightbox-content">
          <div className="facility-lightbox-toolbar">
            <span>
              {active !== null
                ? `${arabicNumber(active + 1)} / ${arabicNumber(facilityPhotos.length)}`
                : ""}
            </span>
            <button
              type="button"
              onClick={closePhoto}
              aria-label="إغلاق الصورة"
              autoFocus
            >
              <X size={24} />
            </button>
          </div>
          {photo && (
            <>
              <div className="facility-lightbox-image">
                <Image
                  key={photo.id}
                  src={facilityImage(photo.id)}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  sizes="100vw"
                  loading="eager"
                />
              </div>
              <div className="facility-lightbox-caption">
                <div aria-live="polite">
                  <h2>{photo.title}</h2>
                  <p>{photo.description}</p>
                </div>
                <div className="facility-lightbox-navigation">
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    aria-label="الصورة السابقة"
                  >
                    <ArrowLeft size={22} className="facility-arrow-previous" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    aria-label="الصورة التالية"
                  >
                    <ArrowLeft size={22} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
