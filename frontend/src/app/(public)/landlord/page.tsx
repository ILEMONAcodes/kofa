import { StatePanel } from "@/components/common/state-panel";
export default function Landlord() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-primary">List with Kof’a</p>
        <h1 className="mt-2 text-3xl">Let’s introduce your property.</h1>
        <p className="mt-4 max-w-prose text-muted">
          Share your contact details, property information, photos, video and
          ownership evidence. Our team reviews the submission before
          publication.
        </p>
      </div>
      <StatePanel title="Property submission is being prepared">
        <p>
          The listing flow will include contact registration, property details,
          pricing, features, photo and video uploads, and a review step. No
          landlord account is required.
        </p>
      </StatePanel>
    </div>
  );
}
