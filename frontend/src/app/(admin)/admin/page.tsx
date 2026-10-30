import Link from "next/link";
import { buttonStyles } from "@/components/common/button";
import { StatePanel } from "@/components/common/state-panel";
export default function Admin() {
  return (
    <StatePanel title="Staff workspace foundation">
      <p>
        Staff authentication and permissions are not connected yet. This preview
        contains no operational controls or private data. Access must be
        enforced by the backend before integration.
      </p>
      <Link
        href="/staff-preview/overview"
        className={buttonStyles("secondary", "mt-6")}
      >
        Open staff design preview
      </Link>
      <Link
        href="/administration-preview/administration"
        className={buttonStyles("secondary", "mt-4")}
      >
        Open administration design preview
      </Link>
    </StatePanel>
  );
}
