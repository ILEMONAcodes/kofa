"use client";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/common/button";
import { Modal } from "@/components/common/modal";
import type { DetailPhoto } from "./detail-content";
export function DetailGallery({
  photos,
  open,
  onClose,
  initialIndex = 0,
}: {
  photos: DetailPhoto[];
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const photo = photos[index];
  return (
    <Modal open={open} onClose={onClose} title="Explore every angle.">
      <div className="detail-gallery-dialog">
        <div
          className="detail-dialog-actions"
          role="group"
          aria-label="Media type"
        >
          <Button
            variant={mode === "photo" ? "primary" : "secondary"}
            aria-pressed={mode === "photo"}
            onClick={() => setMode("photo")}
          >
            Photos
          </Button>
          <Button
            variant={mode === "video" ? "primary" : "secondary"}
            aria-pressed={mode === "video"}
            onClick={() => setMode("video")}
          >
            Video walkthrough
          </Button>
        </div>
        {mode === "photo" ? (
          <>
            <div className="detail-expanded-photo">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="600px"
                unoptimized
                className="home-cover"
              />
            </div>
            <p aria-live="polite">
              {photo.label} · {index + 1} of {photos.length}
            </p>
            <div className="detail-dialog-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  setIndex((index + photos.length - 1) % photos.length)
                }
              >
                Previous photo
              </Button>
              <Button onClick={() => setIndex((index + 1) % photos.length)}>
                Next photo
              </Button>
            </div>
          </>
        ) : (
          <p role="status" className="detail-notice">
            A video walkthrough is not available for this property.
          </p>
        )}
        <Button variant="secondary" onClick={onClose}>
          Back to property
        </Button>
      </div>
    </Modal>
  );
}
export function PropertyGallery({ photos }: { photos: DetailPhoto[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <div
        className={`detail-gallery${photos.length === 1 ? " detail-gallery-single" : ""}`}
        data-node-id="15:420"
      >
        {photos.map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            className={`detail-photo detail-photo-${index}`}
            data-node-id={["15:421", "15:423", "15:424"][index]}
            aria-label={`Open photo ${index + 1}: ${photo.label}`}
            onClick={() => setSelected(index)}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority={index === 0}
              unoptimized
              sizes={index === 0 ? "792px" : "384px"}
              className="home-cover"
              data-detail-asset={`photo-${index + 1}`}
            />
            {index === 0 && (
              <span
                className="mobile-only mobile-gallery-counter"
                aria-hidden="true"
              >
                1 / {photos.length}
              </span>
            )}
          </button>
        ))}
      </div>
      {selected !== null && (
        <DetailGallery
          key={selected}
          photos={photos}
          initialIndex={selected}
          open
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
