"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { SearchBudget } from "@/components/browse/search-budget";
import { BrandLoading } from "@/components/common/brand-loading";
import { useLocalAccess } from "@/components/access/local-access";
import {
  useStaffResource,
  staffWrite,
} from "@/components/features/live-staff/data";
import { apiRequest } from "@/lib/api/client";
import type {
  InquirySummary,
  InquiryDetail,
  InquiryMessage,
  InquiryNote,
  InquiryClient,
  InquiryClientDetail,
} from "@/types/inquiry";
import { inquiryStatuses } from "@/types/inquiry";
import { inquiryHref, qualification, terminal, words, unread } from "./model";
import { formatStaffDate } from "@/lib/formatters/date";
import { formatMoney } from "@/lib/formatters/money";
import type { PropertyDetail } from "@/types/property";
const option = (value: string, label = words(value)) => ({ value, label });
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Unable to continue. Please try again.";
function Frame({ staff, children }: { staff: boolean; children: ReactNode }) {
  const access = useLocalAccess();
  return (
    <main
      id="main-content"
      className={staff ? "inquiry-live staff-live" : "inquiry-live"}
    >
      <header className="inquiry-header">
        <Link href={staff ? "/staff/overview" : "/"} aria-label="Kof’a home">
          <Image
            src="/assets/kofa-logo.svg"
            width={105}
            height={40}
            alt="Kof’a"
          />
        </Link>
        <p>Welcome, {access.user?.full_name.split(" ")[0] ?? "there"}</p>
      </header>
      <nav aria-label={staff ? "Staff workspace" : "Account navigation"}>
        {staff ? (
          <>
            <Link href="/staff/properties">Properties</Link>
            <Link href="/staff/inquiries">Inquiries</Link>
            <Link href="/staff/clients">Clients</Link>
            <Link href="/staff/inspections">Inspections</Link>
          </>
        ) : (
          <>
            <Link href="/">Home</Link>
            <Link href="/properties">Explore</Link>
            <Link href="/account/inquiries">Inquiries</Link>
            <Link href="/account/overview">Account</Link>
            <Link href="/account/inspections">Inspections</Link>
          </>
        )}
      </nav>
      <div className="inquiry-content">{children}</div>
    </main>
  );
}
function Pager({
  page,
  total,
  set,
}: {
  page: number;
  total: number;
  set: (n: number) => void;
}) {
  return (
    <div className="inquiry-actions">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => set(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {Math.max(1, total)}
      </span>
      <Button
        variant="secondary"
        disabled={page >= total}
        onClick={() => set(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
function Card({ record, staff }: { record: InquirySummary; staff: boolean }) {
  return (
    <Link className="inquiry-card" href={inquiryHref(staff, record.id)}>
      <strong>{record.property?.title ?? "Speak to our team"}</strong>
      <span>
        {words(record.status)} · {formatStaffDate(record.updated_at, "date")}
      </span>
      {unread(record) && (
        <span>
          {record.unread_count} unread{" "}
          {record.unread_count === 1 ? "message" : "messages"}
        </span>
      )}
      <small>{record.reference}</small>
    </Link>
  );
}
function Listing({
  staff,
  overview = false,
}: {
  staff: boolean;
  overview?: boolean;
}) {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [q, setQ] = useState(""),
    [assigned, setAssigned] = useState("");
  const access = useLocalAccess();
  const query = new URLSearchParams({ page: String(page), page_size: "12" });
  if (status) query.set("status", status);
  if (q) query.set("q", q);
  if (assigned) query.set("assigned_to", assigned);
  const resource = useStaffResource<InquirySummary[]>(
    staff ? "/admin/inquiries" : "/inquiries",
    query.toString(),
  );
  return (
    <>
      <h1>
        {overview
          ? "Your next move, together."
          : staff
            ? "Client inquiries"
            : "Your inquiries"}
      </h1>
      <p>Keep conversations and payments on Kof’a’s approved channels.</p>
      {!staff && (
        <Link className="inquiry-primary" href="/account/general-inquiry">
          Speak to our team
        </Link>
      )}
      <div className="inquiry-filters">
        <Input
          label="Search inquiries"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Dropdown
          label="Filter status"
          value={status}
          options={[
            option("", "All inquiries"),
            ...inquiryStatuses.map((s) => option(s)),
          ]}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
        {staff && (
          <Dropdown
            label="Assignment"
            value={assigned}
            options={[
              option("", "All team members"),
              option(access.user?.id ?? "", "Assigned to me"),
            ]}
            onChange={(e) => {
              setAssigned(e.target.value);
              setPage(1);
            }}
          />
        )}
      </div>
      {resource.error ? (
        <p role="alert">{message(resource.error)}</p>
      ) : resource.loading ? (
        <BrandLoading />
      ) : resource.data?.length ? (
        resource.data.map((r) => <Card key={r.id} record={r} staff={staff} />)
      ) : (
        <p>
          No inquiries yet. Explore a property or speak to our team to get
          started.
        </p>
      )}
      <Button variant="secondary" onClick={resource.reload}>
        Refresh inquiries
      </Button>
      <Pager
        page={page}
        total={resource.meta?.total_pages ?? 0}
        set={setPage}
      />
    </>
  );
}
function BudgetFields({
  min,
  max,
  date,
  set,
}: {
  min: string;
  max: string;
  date: string;
  set: (name: string, value: string) => void;
}) {
  return (
    <>
      <SearchBudget
        label="Minimum budget (₦)"
        value={min}
        onChange={(v) => set("min", v)}
      />
      <SearchBudget
        label="Maximum budget (₦)"
        value={max}
        onChange={(v) => set("max", v)}
      />
      <Input
        label="Preferred move-in date"
        type="date"
        value={date}
        onChange={(e) => set("date", e.target.value)}
      />
    </>
  );
}
function Compose({ general }: { general: boolean }) {
  const params = useSearchParams(),
    router = useRouter();
  const slug = params.get("property");
  const property = useStaffResource<PropertyDetail>(
    !general && slug ? `/properties/${encodeURIComponent(slug)}` : null,
  );
  const [kind, setKind] = useState("property_interest"),
    [body, setBody] = useState(""),
    [fields, setFields] = useState({ min: "", max: "", date: "" }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ payload: string; key: string } | null>(null),
    locked = useRef(false);
  // Keep a stable key across retries after an unknown network outcome.
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        kind: general ? "general" : kind,
        property_id: general ? null : property.data?.id,
        body,
        ...qualification(fields.min, fields.max, fields.date),
      };
      if (!general && !payload.property_id)
        throw new Error("Choose an available property before sending.");
      const fingerprint = JSON.stringify(payload);
      if (request.current?.payload !== fingerprint)
        request.current = { payload: fingerprint, key: crypto.randomUUID() };
      const { ensureCsrf } = await import("@/lib/auth/client");
      await ensureCsrf();
      const result = await apiRequest<{ id: string }>("/inquiries", {
        method: "POST",
        body: payload,
        headers: { "Idempotency-Key": request.current.key },
      });
      router.push(inquiryHref(false, result.data.id));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return (
    <>
      <h1>{general ? "Speak to our team." : "Let’s take the next step."}</h1>
      {!general &&
        (property.error ? (
          <p role="alert">{message(property.error)}</p>
        ) : property.data ? (
          <p>{property.data.title}</p>
        ) : (
          <p>
            Choose a property from <Link href="/properties">Explore</Link>.
          </p>
        ))}
      <form onSubmit={submit} className="inquiry-form">
        <fieldset disabled={busy}>
          <legend className="sr-only">Inquiry details</legend>
          {!general && (
            <Dropdown
              label="Request type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={[
                option("property_interest", "Express interest"),
                option("inspection_request", "Request inspection"),
              ]}
            />
          )}
          <BudgetFields
            {...fields}
            set={(n, v) => setFields((p) => ({ ...p, [n]: v }))}
          />
          <label className="journey-field">
            Your message
            <textarea
              required
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <p>
            Our team will reply here. An inspection request does not confirm an
            appointment.
          </p>
          {error && (
            <p role="alert">
              {error} <Link href="/account/inquiries">Open your inquiries</Link>
            </p>
          )}
          <Button type="submit" disabled={busy || (!general && !property.data)}>
            {busy ? "Sending…" : "Send inquiry"}
          </Button>
        </fieldset>
      </form>
    </>
  );
}
function Thread({ staff }: { staff: boolean }) {
  const params = useSearchParams(),
    id = params.get("id");
  const [page, setPage] = useState(1),
    [body, setBody] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const base = id
    ? `${staff ? "/admin" : ""}/inquiries/${encodeURIComponent(id)}`
    : null;
  const detail = useStaffResource<InquirySummary | InquiryDetail>(base);
  const thread = useStaffResource<InquiryMessage[]>(
    base ? `${base}/messages` : null,
    `page=${page}&page_size=20`,
  );
  const [notePage, setNotePage] = useState(1);
  const team = useStaffResource<{ staff: { id: string; full_name: string }[] }>(
    staff ? "/admin/property-options" : null,
  );
  const notes = useStaffResource<InquiryNote[]>(
    staff && base ? `${base}/notes` : null,
    `page_size=20&page=${notePage}`,
  );
  const access = useLocalAccess();
  const lock = useRef(false);
  const reloadDetail = detail.reload,
    reloadThread = thread.reload;
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        reloadDetail();
        reloadThread();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [reloadDetail, reloadThread]);
  const acknowledged = useRef<string | null>(null);
  const incomingId = thread.data
    ?.filter((item) => item.sender_role === (staff ? "client" : "staff"))
    .at(-1)?.id;
  const unreadCount = detail.data?.unread_count ?? 0;
  useEffect(() => {
    if (!base || !incomingId || unreadCount === 0) return;
    const key = `${base}:${incomingId}`;
    const acknowledge = () => {
      if (
        document.visibilityState !== "visible" ||
        acknowledged.current === key
      )
        return;
      acknowledged.current = key;
      void staffWrite(`${base}/read`, "POST", {
        through_message_id: incomingId,
      }).catch(() => {
        if (acknowledged.current === key) acknowledged.current = null;
        setError(
          "Unable to mark these messages as read. Your conversation is unchanged.",
        );
      });
    };
    acknowledge();
    document.addEventListener("visibilitychange", acknowledge);
    return () => document.removeEventListener("visibilitychange", acknowledge);
  }, [base, incomingId, unreadCount]);
  const row = detail.data;
  const admin = row && "version" in row ? row : null;
  async function mutate(suffix: string, payload: unknown, method = "POST") {
    if (!base || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await staffWrite(base + suffix, method, payload);
      detail.reload();
      thread.reload();
      notes.reload();
      if (suffix === "/messages") setBody("");
      if (suffix === "/notes") setNote("");
    } catch (e) {
      setError(message(e));
      detail.reload();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (!id)
    return (
      <>
        <h1>Choose a conversation</h1>
        <Link href={staff ? "/staff/inquiries" : "/account/inquiries"}>
          Open inquiries
        </Link>
      </>
    );
  if (detail.error) return <p role="alert">{message(detail.error)}</p>;
  if (!row) return <BrandLoading />;
  return (
    <>
      <h1>{row.property?.title ?? "A conversation worth keeping."}</h1>
      <p>
        {words(row.status)} · {row.reference}
      </p>
      <p>Keep all conversations and payments on Kof’a’s approved channels.</p>
      {staff && row.property && row.status === "qualified" && (
        <Link
          className="inquiry-primary"
          href={`/staff/schedule-inspection?inquiry_id=${row.id}`}
        >
          Schedule inspection
        </Link>
      )}
      <Link
        href={
          staff
            ? `/staff/inspections?inquiry_id=${row.id}`
            : "/account/inspections"
        }
      >
        View inspections
      </Link>
      {row.property?.slug && (
        <Link href={`/properties/${row.property.slug}`}>View property</Link>
      )}
      {error && <p role="alert">{error}</p>}
      <section aria-label="Conversation" className="inquiry-messages">
        {thread.error ? (
          <p role="alert">{message(thread.error)}</p>
        ) : thread.loading ? (
          <BrandLoading />
        ) : (
          thread.data?.map((m) => (
            <article key={m.id} className={`inquiry-message ${m.sender_role}`}>
              <strong>
                {m.sender_role === "staff" ? "Kof’a team" : "Client"}
              </strong>
              <p>{m.body}</p>
              <small>{formatStaffDate(m.created_at)}</small>
            </article>
          ))
        )}
      </section>
      <Pager page={page} total={thread.meta?.total_pages ?? 0} set={setPage} />
      <Button
        variant="secondary"
        onClick={() => {
          thread.reload();
          detail.reload();
        }}
      >
        Refresh conversation
      </Button>
      {!terminal.has(row.status) ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("/messages", { body });
          }}
          className="inquiry-form"
        >
          <label className="journey-field">
            {staff ? "Reply to client" : "Your reply"}
            <textarea
              required
              maxLength={4000}
              disabled={busy}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            Send reply
          </Button>
        </form>
      ) : (
        <p>
          This inquiry is closed.{" "}
          <Link href="/account/general-inquiry">Start a new inquiry</Link>
        </p>
      )}
      {staff && admin && (
        <>
          <section className="inquiry-card">
            <h2>Client and assignment</h2>
            <Link href={`/staff/client?id=${admin.client.id}`}>
              {admin.client.full_name}
            </Link>
            <p>
              {admin.client.email} · {admin.client.phone}
            </p>
            {!terminal.has(row.status) && (
              <Dropdown
                label="Assign team member"
                value={admin.assigned_staff?.id ?? ""}
                disabled={busy || !team.data}
                options={[
                  option("", "Unassigned"),
                  ...(team.data?.staff ?? []).map((member) =>
                    option(member.id, member.full_name),
                  ),
                ]}
                onChange={(e) =>
                  void mutate("/assign", {
                    version: admin.version,
                    assigned_staff_id: e.target.value || null,
                  })
                }
              />
            )}
            <p>
              Assigned to: {admin.assigned_staff?.full_name ?? "Unassigned"}
            </p>
            {!terminal.has(row.status) && (
              <>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void mutate("/assign", {
                      version: admin.version,
                      assigned_staff_id: access.user?.id,
                    })
                  }
                >
                  Assign to me
                </Button>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() =>
                    void mutate("/assign", {
                      version: admin.version,
                      assigned_staff_id: null,
                    })
                  }
                >
                  Unassign
                </Button>
              </>
            )}
          </section>
          {!terminal.has(row.status) && (
            <StaffControls
              key={admin.version}
              row={admin}
              busy={busy}
              mutate={mutate}
            />
          )}
          <section className="inquiry-notes" aria-label="Internal notes">
            <h2>Internal notes · staff only</h2>
            <p>These notes are not sent to the client.</p>
            {notes.error ? (
              <p role="alert">{message(notes.error)}</p>
            ) : (
              notes.data?.map((n) => (
                <article key={n.id}>
                  <p>{n.body}</p>
                  <small>{formatStaffDate(n.created_at)}</small>
                </article>
              ))
            )}
            <Pager
              page={notePage}
              total={notes.meta?.total_pages ?? 0}
              set={setNotePage}
            />
            {!terminal.has(row.status) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate("/notes", { body: note });
                }}
              >
                <label className="journey-field">
                  Private note
                  <textarea
                    required
                    maxLength={4000}
                    value={note}
                    disabled={busy}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <Button disabled={busy} type="submit">
                  Save internal note
                </Button>
              </form>
            )}
          </section>
          <section>
            <h2>Status history</h2>
            {admin.history.map((h, i) => (
              <p key={i}>
                {words(h.to_status)} · {formatStaffDate(h.created_at)}
                {h.reason ? ` · ${h.reason}` : ""}
              </p>
            ))}
          </section>
        </>
      )}
    </>
  );
}
function StaffControls({
  row,
  busy,
  mutate,
}: {
  row: InquiryDetail;
  busy: boolean;
  mutate: (suffix: string, payload: unknown, method?: string) => Promise<void>;
}) {
  const [fields, setFields] = useState({
      min: row.budget_min === null ? "" : formatMoney(row.budget_min).slice(1),
      max: row.budget_max === null ? "" : formatMoney(row.budget_max).slice(1),
      date: row.desired_move_in ?? "",
    }),
    [action, setAction] = useState(row.allowed_actions[0] ?? ""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <form
        className="inquiry-card"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const data = qualification(fields.min, fields.max, fields.date);
            setError("");
            void mutate(
              "/qualification",
              { version: row.version, ...data },
              "PUT",
            );
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        <h2>Qualification</h2>
        <BudgetFields
          {...fields}
          set={(n, v) => setFields((p) => ({ ...p, [n]: v }))}
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>
          Save qualification
        </Button>
      </form>
      <form
        className="inquiry-card"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate("/transitions", {
            version: row.version,
            action,
            reason: reason || null,
          });
        }}
      >
        <h2>Update status</h2>
        <Dropdown
          label="Status action"
          value={action}
          options={row.allowed_actions.map((a) => option(a))}
          onChange={(e) => setAction(e.target.value)}
        />
        <Input
          label="Reason"
          required={["close_lost", "mark_spam"].includes(action)}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button type="submit" disabled={busy || !action}>
          Update inquiry
        </Button>
      </form>
    </>
  );
}
function Clients({ single }: { single: boolean }) {
  const id = useSearchParams().get("id");
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const resource = useStaffResource<InquiryClient[] | InquiryClientDetail>(
    single ? (id ? `/admin/clients/${id}` : null) : "/admin/clients",
    single
      ? ""
      : new URLSearchParams({
          q,
          page: String(page),
          page_size: "20",
        }).toString(),
  );
  const row =
    resource.data && !Array.isArray(resource.data) ? resource.data : null;
  async function activity() {
    if (
      !row ||
      !window.confirm(
        `${row.is_active ? "Deactivate" : "Reactivate"} this client account?`,
      )
    )
      return;
    setBusy(true);
    try {
      await staffWrite(`/admin/clients/${row.id}`, "PATCH", {
        version: row.version,
        is_active: !row.is_active,
      });
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{single ? "Client details" : "Clients"}</h1>
      {!single && (
        <Input
          label="Search clients"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      {resource.error ? (
        <p role="alert">{message(resource.error)}</p>
      ) : resource.loading ? (
        <BrandLoading />
      ) : row ? (
        <>
          <h2>{row.full_name}</h2>
          <p>
            {row.email} · {row.phone}
          </p>
          <p>
            {row.is_active ? "Active" : "Inactive"} · {row.inquiry_count}{" "}
            inquiries
          </p>
          <Button onClick={() => void activity()} disabled={busy}>
            {row.is_active ? "Deactivate client" : "Reactivate client"}
          </Button>
          <h2>Recent inquiries</h2>
          {row.inquiries.map((r) => (
            <Card key={r.id} record={r} staff />
          ))}
          {row.inquiry_count > 20 && (
            <p>
              Showing the 20 most recent inquiries. Use the inquiry inbox for
              older conversations.
            </p>
          )}
        </>
      ) : Array.isArray(resource.data) && resource.data.length ? (
        resource.data.map((c) => (
          <Link
            className="inquiry-card"
            key={c.id}
            href={`/staff/client?id=${c.id}`}
          >
            <strong>{c.full_name}</strong>
            <span>{c.email}</span>
            <span>{c.is_active ? "Active" : "Inactive"}</span>
          </Link>
        ))
      ) : (
        <p>
          {single ? "Choose a client from the directory." : "No clients found."}
        </p>
      )}
      {!single && (
        <Pager
          page={page}
          total={resource.meta?.total_pages ?? 0}
          set={setPage}
        />
      )}
    </>
  );
}
export function LiveInquiries({
  view,
  staff = false,
}: {
  view: string;
  staff?: boolean;
}) {
  const params = useSearchParams();
  let content: ReactNode;
  if (staff && ["clients", "client", "client-saved"].includes(view))
    content = <Clients key={params.get("id")} single={view !== "clients"} />;
  else if (["inquiry", "general-inquiry"].includes(view) && !staff)
    content = (
      <Compose
        key={params.get("property")}
        general={view === "general-inquiry"}
      />
    );
  else if (["overview", "inquiries"].includes(view))
    content = <Listing staff={staff} overview={view === "overview"} />;
  else content = <Thread key={params.get("id")} staff={staff} />;
  return <Frame staff={staff}>{content}</Frame>;
}
