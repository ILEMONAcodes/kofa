"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLoading } from "@/components/common/brand-loading";
import { Button, buttonStyles } from "@/components/common/button";

import {accountSession,signIn,registerAccount,signOut} from "@/lib/auth/client";
import type {AccountUser, Registration} from "@/types/auth";
import { reviewHome } from "@/lib/review-routing";


export type LocalRole = "client" | "staff" | "admin";
const KEY = "kofa-local-access-v1";
export function validLocalRole(value: unknown): value is LocalRole {
  return value === "client" || value === "staff" || value === "admin";
}
export function canOpenLocalArea(
  role: LocalRole | null,
  area: "client" | "staff" | "admin",
) {
  return area === "client"
    ? role !== null
    : area === "staff"
      ? role === "staff" || role === "admin"
      : role === "admin";
}
const Access = createContext<{
  role: LocalRole | null;
  user: AccountUser | null;
  ready: boolean;
  leaving: boolean;
  enter: (email:string,password:string,intent:"login"|"register",registration?:Registration) => Promise<LocalRole>;
  leave: () => Promise<void>;
}>({
  role: null,
  user: null,
  ready: false,
  leaving: false,
  enter: async () => {throw new Error("Access provider required.");},
  leave: async () => {},
});
export function LocalAccessProvider({ children }: { children: ReactNode }) {
  const [user,setUser] = useState<AccountUser|null>(null);
  const role=user?.role ?? null;
  const revision=useRef(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLeaving(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  useEffect(() => {
    let live=true;
    // Retire the editable browser role marker. Only the server cookie assigns a role.
    try { sessionStorage.removeItem(KEY); sessionStorage.removeItem("kofa-local-staff-v1"); } catch {}
    const version=revision.current;
    accountSession().then(next=>{if(live && revision.current===version)setUser(next);}).catch(()=>{}).finally(()=>{if(live)setReady(true);});
    return ()=>{live=false;};
  }, []);
  async function enter(email:string,password:string,intent:"login"|"register",registration?:Registration) {
    revision.current++;
    if(intent==="register" && !registration) throw new Error("Complete your registration details.");
    const next=intent==="register" ? await registerAccount(registration!) : await signIn(email,password);
    setLeaving(false);setUser(next);return next.role;
  }
  async function leave() {
    revision.current++;
    await signOut();setLeaving(true);setUser(null);
  }
  return (
    <Access.Provider value={{ role, user, ready, leaving, enter, leave }}>
      {children}
    </Access.Provider>
  );
}
export const useLocalAccess = () => useContext(Access);
export function LocalGate({
  area,
  children,
}: {
  area: "client" | "staff" | "admin";
  children: ReactNode;
}) {
  const { role, ready, leaving } = useLocalAccess();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (ready && !role && !leaving)
      router.replace(
        `/login?returnTo=${encodeURIComponent(pathname + window.location.search)}`,
      );
  }, [ready, role, router, pathname, area, leaving]);
  if (!ready)
    return (
      <main id="main-content">
        <BrandLoading />
      </main>
    );
  if (!role)
    return (
      <main id="main-content">
        <BrandLoading />
      </main>
    );
  if (!canOpenLocalArea(role, area))
    return (
      <main id="main-content" className="page-container">
        <h1 className="text-2xl">This area needs a different role.</h1>
        <Link href={role ? reviewHome(role) : "/login"} className={buttonStyles("primary", "mt-5")}>
          Back to my workspace
        </Link>
      </main>
    );
  return <>{children}</>;
}
export function AccessStatus() {
  const { role, leave } = useLocalAccess();
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  if (!role) return null;
  return (
    <aside className="local-access-bar" aria-label="Account access">
      <span>
        Signed in ·{" "}
        {role === "admin"
          ? "Administrator"
          : role === "staff"
            ? "Staff"
            : "Your account"}
      </span>
      <span role={notice ? "alert" : undefined}>{notice || ""}</span>
      <Button
        variant="subtle"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {await leave();window.location.replace("/");}
          catch {setNotice("Unable to sign out. Try again.");setBusy(false);}
        }}
      >
        Sign out
      </Button>
    </aside>
  );
}
