import { StatePanel } from "@/components/common/state-panel";
// [id] is the requested route-folder name; its public value is a property SLUG (§4.5), never a private ID lookup.
export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <StatePanel title="Property details are being connected">
      <p>
        Photos, video, pricing and verification details will appear here when
        the public property API is available.
      </p>
    </StatePanel>
  );
}
