"use client";
import { HomeLink } from "@/components/browse/home-link";
import { useLocalAccess } from "./local-access";
export function AccountEntry() {
  const { role } = useLocalAccess();
  return (
    <HomeLink href={role ? "/account" : "/login"} className="home-nav-login">
      {role ? "My account" : "Log in"}
    </HomeLink>
  );
}
