"use client";
import { useSearchParams } from "next/navigation";
import { InspectionFrame } from "./frame";
import { InspectionList } from "./list";
import { InspectionDetail } from "./detail";
import { SlotForm } from "./slot";
export function LiveInspections({
  view,
  staff = false,
}: {
  view: string;
  staff?: boolean;
}) {
  const params = useSearchParams();
  const key = params.get("id") ?? params.get("inquiry_id") ?? view;
  return (
    <InspectionFrame staff={staff}>
      {view === "inspections" || view === "calendar" ? (
        <InspectionList
          key={view}
          staff={staff}
          calendar={view === "calendar"}
        />
      ) : view === "schedule-inspection" ? (
        <SlotForm key={key} />
      ) : (
        <InspectionDetail key={key} staff={staff} />
      )}
    </InspectionFrame>
  );
}
