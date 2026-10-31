"use client";
import { usePathname } from "next/navigation";
import { LocalGate } from "@/components/access/local-access";
export default function Layout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/staff/login" ? (
    children
  ) : (
    <LocalGate area="staff">{children}</LocalGate>
  );
}
