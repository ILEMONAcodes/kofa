"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/common/modal";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { PopoverSelect } from "@/components/common/popover-select";
import { DetailGallery } from "./detail-gallery";
import type { DetailPhoto } from "./detail-content";
export function DetailActions({
  photos,
  title,
}: {
  photos: DetailPhoto[];
  title: string;
}) {
  const [view, setView] = useState("");
  const [reason, setReason] = useState("outside");
  const [other, setOther] = useState("");
  useEffect(() => {
    const update = () => {
      if (window.location.hash === "#assistant") setView("assistant");
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  function close() {
    setView("");
    if (window.location.hash === "#assistant")
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
  }
  return (
    <>
      <button
        type="button"
        className="desktop-only detail-report-link text-sm font-medium text-primary"
        onClick={() => setView("report")}
      >
        Something doesn’t look right? Report this listing →
      </button>
      <div className="mobile-only mobile-detail-report">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setView("report")}
        >
          Report this listing
        </Button>
        <p className="text-home-caption text-muted">
          Explore the photos and property details.
        </p>
      </div>
      <div className="detail-support-actions" data-node-id="88:14848">
        <Button variant="primary" onClick={() => setView("gallery")}>
          Photos &amp; video
        </Button>
        <Button variant="secondary" onClick={() => setView("report")}>
          Report this listing
        </Button>
        <Button variant="secondary" onClick={() => setView("assistant")}>
          Ask the assistant
        </Button>
      </div>
      {view === "gallery" && (
        <DetailGallery photos={photos} open onClose={close} />
      )}
      <Modal
        open={view === "report"}
        onClose={close}
        title="Something doesn’t look right?"
      >
        <div className="detail-dialog-content">
          <p>{title}</p>
          <p className="text-sm text-muted">
            Report this listing. Our team investigates before deciding on
            action.
          </p>
          <PopoverSelect
            label="Reason"
            title="Reason"
            description="Choose an option, or Other to specify."
            value={reason}
            onChange={setReason}
            options={[
              { value: "fake", label: "Fake listing" },
              { value: "price", label: "Wrong price" },
              { value: "description", label: "Misleading description" },
              { value: "unavailable", label: "Already let or sold" },
              { value: "agent", label: "Unauthorised agent" },
              { value: "outside", label: "Asked to pay outside" },
              { value: "other", label: "Other" },
            ]}
          />
          {reason === "other" && (
            <Input
              label="Specify your concern"
              value={other}
              onChange={(event) => setOther(event.target.value)}
            />
          )}
          <p role="status" className="detail-notice">
            Reporting is currently unavailable. Your report has not been sent.
          </p>
          <Button disabled>Submit report</Button>
          <Button variant="secondary" onClick={close}>
            Back to listing
          </Button>
        </div>
      </Modal>
      <Modal
        open={view === "assistant"}
        onClose={close}
        title="A little guidance, when you need it."
      >
        <div className="detail-dialog-content">
          <p>Kof’a AI assistant</p>
          <p className="detail-notice">
            The assistant is currently unavailable. Please try again later.
          </p>
          <Button disabled>Phone support unavailable</Button>
          <p className="text-sm text-muted">
            Phone support is currently unavailable. Visit Help for other support
            options.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              close();
              document
                .getElementById("verification")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            How do property checks work?
          </Button>
          <Button variant="secondary" onClick={close}>
            Back to property
          </Button>
        </div>
      </Modal>
    </>
  );
}
