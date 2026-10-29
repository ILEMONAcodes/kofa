"use client";
/* eslint-disable @next/next/no-img-element -- Local Figma photographs and ephemeral user-selected preview URLs. */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/common/button";
import { Modal } from "@/components/common/modal";
import { fileProblem, type MediaKind } from "./model";
export interface LocalMedia {
  id: string;
  kind: MediaKind;
  name: string;
  url?: string;
  sample?: boolean;
}
export const sampleMedia: LocalMedia[] = [
  "home-living-room.jpg",
  "home-architecture.jpg",
  "home-jabi.jpg",
  "home-living-room.jpg",
  "home-architecture.jpg",
].map((file, i) => ({
  id: `sample-${i}`,
  kind: "photo",
  name: `Sample photo ${i + 1}`,
  url: `/assets/${file}`,
  sample: true,
}));
export function MediaPicker({
  media,
  onChange,
  preview,
}: {
  media: LocalMedia[];
  onChange: (items: LocalMedia[]) => void;
  preview: boolean;
}) {
  const errorRef = useRef<HTMLDivElement>(null);
  const [manage, setManage] = useState(false);
  const [error, setError] = useState("");
  const [retryKind, setRetryKind] = useState<MediaKind>("photo");
  const photos = useRef<HTMLInputElement>(null);
  const documents = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: "nearest" });
      errorRef.current?.focus();
    }
  }, [error]);
  const picker = (kind: MediaKind) =>
    ({ photo: photos, document: documents, video })[kind].current?.click();
  const release = (item: LocalMedia) => {
    if (item.url?.startsWith("blob:")) {
      URL.revokeObjectURL(item.url);
      urls.current.delete(item.url);
    }
  };
  const remove = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (item) release(item);
    onChange(media.filter((m) => m.id !== id));
  };
  function select(kind: MediaKind, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    let next = [...media];
    const errors: string[] = [];
    for (const file of files) {
      const count =
        kind === "video" ? 0 : next.filter((m) => m.kind === kind).length;
      const problem = fileProblem(kind, file, count);
      if (problem) {
        errors.push(`${file.name}: ${problem}`);
        continue;
      }
      if (kind === "video") {
        next.filter((m) => m.kind === "video").forEach(release);
        next = next.filter((m) => m.kind !== "video");
      }
      const url = kind === "document" ? undefined : URL.createObjectURL(file);
      if (url) urls.current.add(url);
      next.push({ id: crypto.randomUUID(), kind, name: file.name, url });
    }
    onChange(next);
    setError(errors.join(" "));
    setRetryKind(kind);
    event.target.value = "";
  }
  const photoItems = media.filter((m) => m.kind === "photo");
  const documentItems = media.filter((m) => m.kind === "document");
  const videoItem = media.find((m) => m.kind === "video");
  function move(id: string, direction: number) {
    const items = [...photoItems];
    const index = items.findIndex((m) => m.id === id);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange([...items, ...media.filter((m) => m.kind !== "photo")]);
  }
  return (
    <>
      <input
        ref={photos}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-label="Select property photos"
        onChange={(e) => select("photo", e)}
      />
      <input
        ref={documents}
        className="sr-only"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        aria-label="Select private ownership evidence"
        onChange={(e) => select("document", e)}
      />
      <input
        ref={video}
        className="sr-only"
        type="file"
        accept="video/mp4,video/webm"
        aria-label="Select optional walkthrough video"
        onChange={(e) => select("video", e)}
      />
      <section className="listing-photo-uploader" aria-label="Property photos">
        <h2>
          Property photos · {photoItems.length} {preview ? "ready" : "selected"}
        </h2>
        <p className="auth-small">
          JPEG, PNG or WebP · up to 10 MB each · maximum 20 photos
        </p>
        <div className="listing-thumbnails">
          {photoItems.length ? (
            photoItems.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setManage(true)}
                aria-label={`Manage photo ${index + 1}${index === 0 ? ", cover" : ""}`}
              >
                <img src={item.url} width="110" height="84" alt={item.name} />
              </button>
            ))
          ) : (
            <p className="auth-small">No photos selected yet.</p>
          )}
        </div>
        <Button variant="secondary" onClick={() => picker("photo")}>
          {photoItems.length ? "Add more photos" : "Add property photos"}
        </Button>
        <p className="auth-small">
          Photo 1 is the cover · Reorder or remove before submitting
        </p>
      </section>
      <section
        className="listing-document-uploader"
        aria-label="Private evidence"
      >
        <h2>Ownership or authorisation evidence</h2>
        <p>
          {documentItems.length
            ? `${documentItems[0].name} · ${preview ? "Ready" : "Selected locally"}${documentItems.length > 1 ? ` (+${documentItems.length - 1})` : ""}`
            : "No evidence selected yet."}
        </p>
        <p className="auth-small">
          PDF, JPEG or PNG · up to 10 MB each · maximum 10 documents. Only
          authorised staff can view these documents.
        </p>
        <Button variant="secondary" onClick={() => picker("document")}>
          Add or replace evidence
        </Button>
      </section>
      <div className="auth-callout">
        <p>
          {preview ? "Uploads can be retried" : "Files stay on this device"}
        </p>
        <p>
          {preview
            ? "If a file fails to upload, try again or remove it before continuing. At least 5 photos and 1 evidence document must be ready before you submit."
            : "These files are selected locally and have not been uploaded. Use sample files while the upload service is being connected."}
        </p>
      </div>
      <section
        className="listing-video-uploader"
        aria-label="Walkthrough video"
      >
        <h2>Walkthrough video · Optional</h2>
        <p className="auth-small">
          One MP4 or WebM · Maximum 100 MB. Video can be skipped.
        </p>
        <Button variant="secondary" onClick={() => picker("video")}>
          {videoItem ? "Replace property video" : "Add property video"}
        </Button>
        {videoItem && (
          <>
            <p className="auth-small">
              {videoItem.name} · {preview ? "Sample only" : "Selected locally"}
            </p>
            {videoItem.url && (
              <video
                src={videoItem.url}
                controls
                preload="metadata"
                aria-label="Selected walkthrough preview"
              />
            )}
            <Button variant="subtle" onClick={() => remove(videoItem.id)}>
              Remove video
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={() => setManage(true)}>
          Manage photos, video &amp; evidence
        </Button>
      </section>
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="listing-error"
          role="alert"
        >
          <p>{error}</p>
          <Button variant="secondary" onClick={() => picker(retryKind)}>
            Retry file selection
          </Button>
          <Button variant="subtle" onClick={() => setError("")}>
            Dismiss file error
          </Button>
        </div>
      )}
      <Modal
        open={manage}
        onClose={() => setManage(false)}
        title="Manage photos, video & evidence"
      >
        <p className="auth-small">
          The first photo is the cover. Nothing is uploaded from this preview.
        </p>
        <div className="listing-media-manager">
          {media.map((item) => (
            <div key={item.id}>
              <p>
                {item.name}
                {item.kind === "photo" && photoItems[0]?.id === item.id
                  ? " · Cover"
                  : ""}
              </p>
              <p className="auth-small">
                {item.kind === "document"
                  ? "Private evidence"
                  : "Property media"}{" "}
                · {item.sample ? "Illustrative sample" : "Selected locally"}
              </p>
              <div>
                {item.kind === "photo" && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={photoItems[0]?.id === item.id}
                      onClick={() => move(item.id, -1)}
                      aria-label={`Move ${item.name} earlier`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={photoItems.at(-1)?.id === item.id}
                      onClick={() => move(item.id, 1)}
                      aria-label={`Move ${item.name} later`}
                    >
                      ↓
                    </Button>
                  </>
                )}
                <Button
                  variant="subtle"
                  onClick={() => remove(item.id)}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!media.length && <p>No files selected.</p>}
      </Modal>
    </>
  );
}
