"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  MediaPicker,
  sampleMedia,
  type LocalMedia,
} from "@/components/features/submission/media";
import Link from "next/link";
import { Input } from "@/components/common/input";
import { Button } from "@/components/common/button";
import { fileProblem } from "@/components/features/submission/model";
import { Modal } from "@/components/common/modal";
const Session = createContext<{
  media: LocalMedia[];
  setMedia: (items: LocalMedia[]) => void;
  caption: string;
  setCaption: (value: string) => void;
  openManager: (kind: "listing" | "report") => void;
  notice: string;
  setNotice: (value: string) => void;
} | null>(null);
export function MediaSession({ children }: { children: ReactNode }) {
  const [media, setMedia] = useState<LocalMedia[]>(sampleMedia);
  const [caption, setCaption] = useState("Living room");
  const [manager, setManager] = useState<"listing" | "report" | null>(null);
  const [evidence, setEvidence] = useState<File[]>([]);
  const [evidenceError, setEvidenceError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Session.Provider
      value={{
        media,
        setMedia,
        caption,
        setCaption,
        notice,
        setNotice,
        openManager: setManager,
      }}
    >
      {children}
      <Modal
        open={manager === "listing"}
        onClose={() => setManager(null)}
        title="Manage local media"
      >
        <div className="media-local-manager">
          <p>
            Nothing is uploaded. Use sample files; private evidence is never
            displayed in the public gallery.
          </p>
          <MediaPicker media={media} onChange={setMedia} preview={false} />
        </div>
      </Modal>
      <Modal
        open={manager === "report"}
        onClose={() => setManager(null)}
        title="Private report evidence"
      >
        <div className="space-y-4">
          <p>
            Up to 3 PDF, JPEG or PNG files, 10 MB each. Selected locally only;
            nothing is uploaded or shown publicly.
          </p>
          <Input
            label="Select report evidence"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => {
              const next = Array.from(event.target.files ?? []);
              const issue = next
                .map((file, index) => fileProblem("document", file, index))
                .find(Boolean);
              if (evidence.length + next.length > 3)
                setEvidenceError("Choose at most 3 evidence files.");
              else if (issue) setEvidenceError(issue);
              else {
                setEvidence([...evidence, ...next]);
                setEvidenceError("");
              }
              event.target.value = "";
            }}
          />
          {evidenceError && (
            <p role="alert" className="text-danger">
              {evidenceError}
            </p>
          )}
          {evidence.map((file, index) => (
            <div key={`${file.name}-${index}`}>
              <p>{file.name} · Private · Selected locally</p>
              <Button
                variant="secondary"
                onClick={() =>
                  setEvidence(evidence.filter((_, i) => i !== index))
                }
              >
                Remove evidence {index + 1}
              </Button>
            </div>
          ))}
          <Link
            href="/media-help-preview/report-evidence"
            className="staff-public-link"
            onClick={() => setManager(null)}
          >
            Preview evidence attached state
          </Link>
        </div>
      </Modal>
    </Session.Provider>
  );
}
export function useMediaSession() {
  const value = useContext(Session);
  if (!value) throw new Error("MediaSession required");
  return value;
}
