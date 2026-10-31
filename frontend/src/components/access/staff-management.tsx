"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
type Member = {
  id: string;
  label: string;
  role: "staff" | "admin";
  active: boolean;
};
const KEY = "kofa-local-staff-v1";
export function StaffManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let saved: Member[] = [];
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(value))
        saved = value.filter(
          (x): x is Member =>
            x &&
            typeof x.id === "string" &&
            typeof x.label === "string" &&
            (x.role === "staff" || x.role === "admin") &&
            typeof x.active === "boolean",
        );
    } catch {
      /* Start fresh if storage is unavailable. */
    }
    const frame = requestAnimationFrame(() => setMembers(saved));
    return () => cancelAnimationFrame(frame);
  }, []);
  function save(next: Member[]) {
    setMembers(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
      setNotice("Updated for this browser tab only. No invitation was sent.");
    } catch {
      setNotice("Updated for this page only; browser storage is unavailable.");
    }
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("label") ?? "").trim();
    if (label.length < 2) {
      setNotice("Enter a team member label of at least two characters.");
      return;
    }
    save([
      ...members,
      {
        id: crypto.randomUUID(),
        label,
        role: data.get("role") === "admin" ? "admin" : "staff",
        active: true,
      },
    ]);
    form.reset();
  }
  return (
    <main id="main-content" className="page-container space-y-6">
      <Link href="/admin/administration" className="text-primary underline">
        Back to administration
      </Link>
      <div>
        <p className="text-sm text-muted">ADMINISTRATION</p>
        <h1 className="text-3xl">Your team, together.</h1>
      </div>
      <p>
        Manage staff and administrator roles. These entries are local examples;
        use invented labels. Live invitations and account provisioning are not
        connected.
      </p>
      <section className="rounded-xl border bg-surface p-5 space-y-4">
        <h2 className="text-xl">Administrator</h2>
        <p>Current local administrator · Active</p>
        <p className="text-sm text-muted">
          Your own account cannot be deactivated here.
        </p>
      </section>
      <section className="rounded-xl border bg-surface p-5 space-y-4">
        <h2 className="text-xl">Add a team member</h2>
        <form onSubmit={add} className="grid gap-4 md:grid-cols-2">
          <Input
            name="label"
            label="Example team member label"
            placeholder="e.g. Property team 2"
            minLength={2}
            maxLength={150}
            required
          />
          <label>
            Role
            <select className="field-control mt-2" name="role">
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <Button type="submit">Add team member</Button>
        </form>
      </section>
      <p role="status">{notice}</p>
      <section className="space-y-4" aria-label="Team members">
        <h2 className="text-xl">Team members</h2>
        {members.length === 0 && <p>No team members added in this tab yet.</p>}
        {members.map((member) => (
          <article
            key={member.id}
            className="rounded-xl border bg-surface p-5 flex flex-wrap items-center gap-4"
          >
            <div className="flex-1">
              <h3>{member.label}</h3>
              <p className="text-sm text-muted">
                {member.role === "admin" ? "Administrator" : "Staff"} ·{" "}
                {member.active ? "Active" : "Inactive"}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                save(
                  members.map((x) =>
                    x.id === member.id ? { ...x, active: !x.active } : x,
                  ),
                )
              }
            >
              {member.active ? "Deactivate" : "Activate"} {member.label}
            </Button>
          </article>
        ))}
      </section>
      <Link href="/staff/overview" className={buttonStyles()}>
        Open staff operations
      </Link>
    </main>
  );
}
