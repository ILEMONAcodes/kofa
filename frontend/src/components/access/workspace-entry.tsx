"use client";
import Link from "next/link";
import { buttonStyles } from "@/components/common/button";
import { useLocalAccess } from "./local-access";
export function WorkspaceEntry() {
  const { role } = useLocalAccess();
  const href =
    role === "admin"
      ? "/admin/administration"
      : role === "staff"
        ? "/staff/overview"
        : "/staff/login";
  return (
    <Link className={buttonStyles("secondary", "mt-4")} href={href}>
      Staff &amp; admin
    </Link>
  );
}
