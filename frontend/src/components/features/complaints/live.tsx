"use client";
import { useSearchParams } from "next/navigation";
import { InspectionFrame } from "@/components/features/inspections/frame";
import { CaseForm } from "./form";
import { CaseList } from "./list";
import { CaseDetailView } from "./detail";
export function LiveComplaints({
  view = "complaints",
  staff = false,
  publicReport = false,
}: {
  view?: string;
  staff?: boolean;
  publicReport?: boolean;
}) {
  const query = useSearchParams(),
    id = query.get("id");
  return (
    <InspectionFrame
      staff={staff}
      backHref={publicReport ? "/properties" : "/account/complaints"}
      helpTitle="Help with your concern"
      helpText="Raise your concern here. Our team investigates before deciding on an action. Do not share card, bank or identity-document numbers."
    >
      {publicReport || view === "complaint-form" ? (
        <CaseForm publicReport={publicReport} />
      ) : view === "complaints" ? (
        <CaseList staff={staff} />
      ) : id ? (
        <CaseDetailView key={id} id={id} staff={staff} />
      ) : (
        <>
          <h1>Choose a concern.</h1>
          <a href={staff ? "/staff/complaints" : "/account/complaints"}>
            Open complaints
          </a>
        </>
      )}
    </InspectionFrame>
  );
}
