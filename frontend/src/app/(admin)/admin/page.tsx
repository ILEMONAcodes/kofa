import Link from "next/link";
import { buttonStyles } from "@/components/common/button";
import { StatePanel } from "@/components/common/state-panel";
export default function Admin() {
  return (
    <StatePanel title="Staff workspace">
      <p>Review properties, manage inquiries and support your clients.</p>
      <Link
        href="/staff-preview/overview"
        className={buttonStyles("primary", "mt-6")}
      >
        Open staff workspace
      </Link>
      <Link
        href="/administration-preview/administration"
        className={buttonStyles("secondary", "mt-4")}
      >
        Open administration
      </Link>
    </StatePanel>
  );
}
