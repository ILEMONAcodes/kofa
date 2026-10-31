"use client";
import { reviewHome } from "@/lib/review-routing";
import { HomeLink } from "@/components/browse/home-link";
import { useLocalAccess } from "./local-access";
export function AccountEntry() {
  const { role } = useLocalAccess();
  return (
    <HomeLink href={role ? reviewHome(role) : "/login"} className="home-nav-login">
      {role ? "My workspace" : "Log in"}
    </HomeLink>
  );
}
