"use client";
/* eslint-disable @next/next/no-img-element -- signed private images must keep staff cookies and bypass the public image optimizer. */
import Image from "next/image";
import { OperationalDashboard } from "@/components/features/reports/dashboard";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useLocalAccess } from "@/components/access/local-access";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { Modal } from "@/components/common/modal";
import { BrandLoading } from "@/components/common/brand-loading";
import { useStaffResource, staffWrite } from "./data";
import { WorkflowPanel } from "./workflow";
import {
  words,
  staffLink,
  statuses,
  priceText,
  errorText,
  StaffInputError,
} from "./model";
import type {
  StaffDetail,
  StaffSummary,
  StaffOptions,
  StaffLandlord,
  StaffOwnerDetail,
  StaffMutation,
  StaffMedia,
} from "@/types/staff-property";
import { formatStaffDate } from "@/lib/formatters/date";
import { parseMoneyInput } from "@/lib/formatters/money";

function Panel({ children }: { children: ReactNode }) {
  return <section className="live-staff-panel">{children}</section>;
}
function RecordLink({ record }: { record: StaffSummary }) {
  return (
    <Link className="live-staff-record" href={staffLink("property", record.id)}>
      {record.cover_image && (
        <img
          src={record.cover_image.thumb_url ?? record.cover_image.url}
          alt={record.cover_image.alt ?? "Property"}
          loading="lazy"
        />
      )}
      <div>
        <h2>{record.title}</h2>
        <p>
          {priceText(record.price.amount)}
          {record.listing_type === "rent" ? ` / ${record.price.period}` : ""}
        </p>
        <p>
          {record.location.neighbourhood} · {words(record.status)}
        </p>
        <p>{record.submission_reference ?? "Draft submission"}</p>
      </div>
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
const option = (value: string, label = words(value)) => ({ value, label });
function Queue({
  view,
  options,
}: {
  view: string;
  options: StaffOptions | null;
}) {
  const params = useSearchParams(),
    router = useRouter();
  const isOwners = view === "landlords";
  const names = isOwners
    ? ["q", "page"]
    : [
        "q",
        "status",
        "area",
        "assigned_to",
        "listing_type",
        "stale_availability",
        "sort",
        "page",
      ];
  const query = new URLSearchParams();
  for (const name of names) {
    const value = params.get(name);
    if (value) query.set(name, value);
  }
  query.set("page_size", "12");
  const resource = useStaffResource<(StaffSummary | StaffLandlord)[]>(
    isOwners ? "/admin/landlords" : "/admin/properties",
    query.toString(),
  );
  const [search, setSearch] = useState(params.get("q") ?? "");
  function filter(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/staff/${view}?${next}`);
  }
  return (
    <>
      <form
        className="live-staff-filters"
        onSubmit={(e) => {
          e.preventDefault();
          filter("q", search);
        }}
      >
        <Input
          label={isOwners ? "Search landlords" : "Search properties"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={150}
        />
        <Button type="submit">Search</Button>
        {!isOwners && (
          <>
            <Dropdown
              label="Status"
              value={params.get("status") ?? ""}
              onChange={(e) => filter("status", e.target.value)}
              options={[
                option("", "All statuses"),
                ...statuses.map((v) => option(v)),
              ]}
            />
            <Dropdown
              label="Neighbourhood"
              value={params.get("area") ?? ""}
              onChange={(e) => filter("area", e.target.value)}
              options={[
                option("", "All neighbourhoods"),
                ...(options?.areas.map((a) =>
                  option(a.slug, `${a.neighbourhood}, ${a.city}`),
                ) ?? []),
              ]}
            />
            <Dropdown
              label="Reviewer"
              value={params.get("assigned_to") ?? ""}
              onChange={(e) => filter("assigned_to", e.target.value)}
              options={[
                option("", "All reviewers"),
                ...(options?.staff.map((s) => option(s.id, s.full_name)) ?? []),
              ]}
            />
            <Dropdown
              label="Rent or buy"
              value={params.get("listing_type") ?? ""}
              onChange={(e) => filter("listing_type", e.target.value)}
              options={[
                option("", "All listings"),
                option("rent", "Rent"),
                option("sale", "Buy"),
              ]}
            />
            <Dropdown
              label="Availability confirmation"
              value={params.get("stale_availability") ?? ""}
              onChange={(e) => filter("stale_availability", e.target.value)}
              options={[
                option("", "All records"),
                option("true", "Needs confirmation"),
                option("false", "Recently confirmed"),
              ]}
            />
            <Dropdown
              label="Sort"
              value={params.get("sort") ?? "-submitted_at"}
              onChange={(e) => filter("sort", e.target.value)}
              options={[
                option("-submitted_at", "Newest submissions"),
                option("submitted_at", "Oldest submissions"),
                option("-updated_at", "Recently updated"),
              ]}
            />
          </>
        )}
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            setSearch("");
            router.replace(`/staff/${view}`);
          }}
        >
          Clear filters
        </Button>
      </form>
      {resource.loading ? (
        <BrandLoading />
      ) : resource.error ? (
        <LoadError error={resource.error} retry={resource.reload} />
      ) : (
        <>
          <p aria-live="polite">
            {resource.meta?.total_items ?? 0}{" "}
            {isOwners ? "landlords" : "properties"}
          </p>
          {!resource.data?.length ? (
            <Panel>
              <h2>No {isOwners ? "landlords" : "properties"} found</h2>
              <p>
                {params.get("q") || params.get("status")
                  ? "Try clearing your filters."
                  : "New landlord submissions will appear here."}
              </p>
            </Panel>
          ) : (
            <div className="live-staff-grid">
              {resource.data.map((record) =>
                isOwners ? (
                  <Link
                    className="live-staff-record"
                    key={record.id}
                    href={staffLink("landlord", record.id)}
                  >
                    <div>
                      <h2>{(record as StaffLandlord).full_name}</h2>
                      <p>{(record as StaffLandlord).phone}</p>
                    </div>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ) : (
                  <RecordLink key={record.id} record={record as StaffSummary} />
                ),
              )}
            </div>
          )}
          {(resource.meta?.total_pages ?? 0) > 1 && (
            <nav aria-label="Results pagination" className="live-staff-actions">
              <Button
                variant="secondary"
                disabled={(resource.meta?.page ?? 1) <= 1}
                onClick={() => {
                  const next = new URLSearchParams(params.toString());
                  next.set("page", String((resource.meta?.page ?? 1) - 1));
                  router.replace(`/staff/${view}?${next}`);
                }}
              >
                Previous
              </Button>
              <span>
                Page {resource.meta?.page} of {resource.meta?.total_pages}
              </span>
              <Button
                disabled={
                  (resource.meta?.page ?? 1) >=
                  (resource.meta?.total_pages ?? 1)
                }
                onClick={() => {
                  const next = new URLSearchParams(params.toString());
                  next.set("page", String((resource.meta?.page ?? 1) + 1));
                  router.replace(`/staff/${view}?${next}`);
                }}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Panel>
      <p role="alert">{errorText(error)}</p>
      <Button onClick={retry}>Try again</Button>
      <Link href="/login">Sign in</Link>
    </Panel>
  );
}
function Overview() {
  return <OperationalDashboard />;
}

type Act = (job: () => Promise<string>) => Promise<boolean>;
function OwnerCard({ owner }: { owner: StaffLandlord }) {
  return (
    <Panel>
      <h2>{owner.full_name}</h2>
      <a href={`tel:${owner.phone}`}>{owner.phone}</a>
      {owner.email && <a href={`mailto:${owner.email}`}>{owner.email}</a>}
      {owner.notes && <p>{owner.notes}</p>}
      {owner.blocked_at && (
        <p>Blocked contact · {owner.blocked_reason ?? "Review required"}</p>
      )}
    </Panel>
  );
}
function PropertyRecord({ record }: { record: StaffDetail }) {
  return (
    <>
      <div className="live-staff-actions">
        {[
          ["Edit listing", "edit-property"],
          ["Assign reviewer", "assign-review"],
          ["Confirm availability", "availability"],
          ["Media and evidence", "media"],
        ].map(([label, view]) => (
          <Link
            key={view}
            className={buttonStyles(
              view === "edit-property" ? "primary" : "secondary",
            )}
            href={staffLink(view, record.id)}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="live-staff-grid">
        <Panel>
          {record.cover_image && (
            <img
              className="journey-photo"
              src={record.cover_image.url}
              alt={record.cover_image.alt ?? record.title}
            />
          )}
          <h2>
            {priceText(record.price.amount)}
            {record.listing_type === "rent" ? ` / ${record.price.period}` : ""}
          </h2>
          <p>
            {words(record.property_type)} · {record.bedrooms} bedrooms ·{" "}
            {record.bathrooms} bathrooms
          </p>
          <p>{record.description}</p>
          <p>
            {record.address_line}, {record.location.neighbourhood},{" "}
            {record.location.city}
          </p>
          <p>{record.payment_terms ?? "No payment terms recorded"}</p>
          <p>{record.landlord_conditions}</p>
          <p>
            Assigned to {record.assigned_staff?.full_name ?? "no reviewer yet"}
          </p>
          <p>
            {words(record.availability_status)} · Last confirmed{" "}
            {record.last_availability_confirmed_at
              ? formatStaffDate(record.last_availability_confirmed_at)
              : "not yet confirmed"}
          </p>
          <p>
            {record.amenities.map((a) => a.label).join(" · ") ||
              "No amenities recorded"}
          </p>
          {record.extra_charges.map((charge, i) => (
            <p key={i}>
              {charge.label}: {priceText(charge.amount)}
            </p>
          ))}
        </Panel>
        <div className="live-staff-stack">
          <OwnerCard owner={record.landlord} />
          <Link href={staffLink("landlord", record.landlord.id)}>
            Open landlord record
          </Link>
          <Panel>
            <h2>Verification and approval</h2>
            <p>
              {record.is_verified
                ? "Verification passed"
                : "Verification not completed"}
            </p>
            {record.verification_history.map((v) => (
              <div key={v.id}>
                <p>
                  {words(v.method)} · {words(v.status)}
                </p>
                <p>{v.scope_summary}</p>
              </div>
            ))}
            <p>
              {record.landlord_approval
                ? `Landlord approval recorded on ${formatStaffDate(record.landlord_approval.approved_at, "date")}`
                : "Current landlord approval is not recorded."}
            </p>
          </Panel>
        </div>
      </div>
      <Panel>
        <h2>Property history</h2>
        {record.status_history.length ? (
          record.status_history.map((item, i) => (
            <p key={i}>
              {words(item.to_status)} · {formatStaffDate(item.created_at)}
              {item.reason ? ` · ${item.reason}` : ""}
            </p>
          ))
        ) : (
          <p>No status changes recorded.</p>
        )}
      </Panel>
    </>
  );
}
function EditProperty({
  record,
  options,
  act,
  busy,
}: {
  record: StaffDetail;
  options: StaffOptions | null;
  act: Act;
  busy: boolean;
}) {
  const [form, setForm] = useState({
    title: record.title,
    description: record.description,
    listing_type: record.listing_type,
    property_type: record.property_type,
    area_id: record.area_id,
    address_line: record.address_line,
    address_hint: record.location.address_hint ?? "",
    price: Number.isSafeInteger(record.price.amount)
      ? priceText(record.price.amount).replace("₦", "")
      : "",
    period: record.price.period,
    bedrooms: String(record.bedrooms),
    bathrooms: String(record.bathrooms),
    furnishing: record.furnishing,
    payment_terms: record.payment_terms ?? "",
    landlord_conditions: record.landlord_conditions ?? "",
    relationship: record.landlord.relationship,
    latitude: record.latitude === null ? "" : String(record.latitude),
    longitude: record.longitude === null ? "" : String(record.longitude),
  });
  const [negotiable, setNegotiable] = useState(record.price_negotiable),
    [amenities, setAmenities] = useState(record.amenities.map((a) => a.code));
  const [charges, setCharges] = useState(
    record.extra_charges.map((c) => ({
      label: c.label,
      amount: priceText(c.amount).replace("₦", ""),
    })),
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const fields = (
    <>
      <Input
        label="Title"
        value={form.title}
        minLength={5}
        maxLength={120}
        required
        onChange={(e) => update("title", e.target.value)}
      />
      <label className="staff-field">
        Description
        <textarea
          value={form.description}
          minLength={20}
          maxLength={5000}
          required
          onChange={(e) => update("description", e.target.value)}
        />
      </label>
      <Dropdown
        label="Rent or buy"
        value={form.listing_type}
        options={[option("rent", "Rent"), option("sale", "Sale")]}
        onChange={(e) =>
          setForm((v) => ({
            ...v,
            listing_type: e.target.value as "rent" | "sale",
            period: e.target.value === "sale" ? "one_time" : "year",
          }))
        }
      />
      <Dropdown
        label="Property type"
        value={form.property_type}
        options={[
          "apartment",
          "house",
          "duplex",
          "bungalow",
          "terrace",
          "studio",
          "room",
        ].map((v) => option(v))}
        onChange={(e) => update("property_type", e.target.value)}
      />
      <Dropdown
        label="Neighbourhood"
        value={form.area_id}
        options={
          options?.areas.map((a) =>
            option(a.id, `${a.neighbourhood}, ${a.city}`),
          ) ?? []
        }
        required
        disabled={!options}
        onChange={(e) => update("area_id", e.target.value)}
      />
      <Input
        label="Exact address (staff only)"
        value={form.address_line}
        minLength={5}
        maxLength={500}
        required
        onChange={(e) => update("address_line", e.target.value)}
      />
      <Input
        label="Address hint"
        value={form.address_hint}
        maxLength={160}
        onChange={(e) => update("address_hint", e.target.value)}
      />
      <Input
        label="Price (₦)"
        prefix="₦"
        inputMode="decimal"
        value={form.price}
        required
        onChange={(e) => update("price", e.target.value)}
      />
      <Dropdown
        label="Price period"
        value={form.period}
        options={(form.listing_type === "sale"
          ? ["one_time"]
          : ["year", "month"]
        ).map((v) => option(v))}
        onChange={(e) => update("period", e.target.value)}
      />
      <Dropdown
        label="Bedrooms"
        value={form.bedrooms}
        options={Array.from({ length: 21 }, (_, n) =>
          option(String(n), String(n)),
        )}
        onChange={(e) => update("bedrooms", e.target.value)}
      />
      <Dropdown
        label="Bathrooms"
        value={form.bathrooms}
        options={Array.from({ length: 21 }, (_, n) =>
          option(String(n), String(n)),
        )}
        onChange={(e) => update("bathrooms", e.target.value)}
      />
      <Dropdown
        label="Furnishing"
        value={form.furnishing}
        options={["unfurnished", "semi_furnished", "furnished"].map((v) =>
          option(v),
        )}
        onChange={(e) => update("furnishing", e.target.value)}
      />
      <Dropdown
        label="Landlord relationship"
        value={form.relationship}
        options={[
          "owner",
          "authorized_agent",
          "developer",
          "property_manager",
        ].map((v) => option(v))}
        onChange={(e) => update("relationship", e.target.value)}
      />
      <Input
        label="Payment terms"
        value={form.payment_terms}
        maxLength={1000}
        onChange={(e) => update("payment_terms", e.target.value)}
      />
      <Input
        label="Landlord conditions"
        value={form.landlord_conditions}
        maxLength={2000}
        onChange={(e) => update("landlord_conditions", e.target.value)}
      />
      <Input
        label="Latitude (optional, staff only)"
        type="number"
        min={-90}
        max={90}
        step="any"
        value={form.latitude}
        onChange={(e) => update("latitude", e.target.value)}
      />
      <Input
        label="Longitude (optional, staff only)"
        type="number"
        min={-180}
        max={180}
        step="any"
        value={form.longitude}
        onChange={(e) => update("longitude", e.target.value)}
      />
    </>
  );
  function money(value: string) {
    try {
      const amount = parseMoneyInput(value);
      if (amount === null) throw new Error();
      return amount;
    } catch {
      throw new StaffInputError(
        "Enter valid naira amounts with no more than two decimal places.",
      );
    }
  }
  return (
    <form
      className="live-staff-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          const result = await staffWrite<StaffMutation>(
            `/admin/properties/${record.id}`,
            "PATCH",
            {
              version: record.version,
              title: form.title,
              description: form.description,
              listing_type: form.listing_type,
              property_type: form.property_type,
              area_id: form.area_id,
              address_line: form.address_line,
              address_hint: form.address_hint || null,
              price: {
                amount: money(form.price),
                currency: "NGN",
                period: form.period,
              },
              bedrooms: Number(form.bedrooms),
              bathrooms: Number(form.bathrooms),
              furnishing: form.furnishing,
              relationship: form.relationship,
              payment_terms: form.payment_terms || null,
              landlord_conditions: form.landlord_conditions || null,
              price_negotiable: negotiable,
              amenity_codes: amenities,
              latitude: form.latitude || null,
              longitude: form.longitude || null,
              extra_charges: charges.map((c) => ({
                label: c.label,
                amount: money(c.amount),
                currency: "NGN",
              })),
            },
          );
          return result.approval_invalidated
            ? "Changes saved. Fresh landlord approval is required."
            : "Changes saved.";
        });
      }}
    >
      <div className="live-staff-grid">{fields}</div>
      <label>
        <input
          type="checkbox"
          checked={negotiable}
          onChange={(e) => setNegotiable(e.target.checked)}
        />{" "}
        Price is negotiable
      </label>
      <fieldset className="live-staff-panel">
        <legend>Amenities</legend>
        {options?.amenities.map((a) => (
          <label key={a.code}>
            <input
              type="checkbox"
              checked={amenities.includes(a.code)}
              onChange={(e) =>
                setAmenities((prev) =>
                  e.target.checked
                    ? [...prev, a.code]
                    : prev.filter((v) => v !== a.code),
                )
              }
            />{" "}
            {a.label}
          </label>
        ))}
      </fieldset>
      <Panel>
        <h2>Additional charges</h2>
        {charges.map((charge, i) => (
          <div className="live-staff-stack" key={i}>
            <Input
              label={`Charge ${i + 1} label`}
              required
              maxLength={100}
              value={charge.label}
              onChange={(e) =>
                setCharges((prev) =>
                  prev.map((c, n) =>
                    n === i ? { ...c, label: e.target.value } : c,
                  ),
                )
              }
            />
            <Input
              label={`Charge ${i + 1} amount (₦)`}
              prefix="₦"
              required
              inputMode="decimal"
              value={charge.amount}
              onChange={(e) =>
                setCharges((prev) =>
                  prev.map((c, n) =>
                    n === i ? { ...c, amount: e.target.value } : c,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setCharges((prev) => prev.filter((_, n) => n !== i))
              }
            >
              Remove charge {i + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={charges.length >= 10}
          onClick={() =>
            setCharges((prev) => [...prev, { label: "", amount: "" }])
          }
        >
          Add charge
        </Button>
      </Panel>
      <Button type="submit" disabled={!options || busy} loading={busy}>
        Save changes
      </Button>
    </form>
  );
}
function Assign({
  record,
  options,
  act,
  busy,
}: {
  record: StaffDetail;
  options: StaffOptions | null;
  act: Act;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(record.assigned_staff?.id ?? "");
  return (
    <form
      className="live-staff-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          await staffWrite(`/admin/properties/${record.id}/assign`, "POST", {
            staff_id: selected || null,
            version: record.version,
          });
          return "Reviewer assignment saved.";
        });
      }}
    >
      <Dropdown
        label="Reviewer"
        value={selected}
        disabled={!options}
        options={[
          option("", "Unassigned"),
          ...(record.assigned_staff &&
          !options?.staff.some((s) => s.id === record.assigned_staff?.id)
            ? [
                option(
                  record.assigned_staff.id,
                  `${record.assigned_staff.full_name} (not active)`,
                ),
              ]
            : []),
          ...(options?.staff.map((s) => option(s.id, s.full_name)) ?? []),
        ]}
        onChange={(e) => setSelected(e.target.value)}
      />
      <Button type="submit" disabled={!options || busy} loading={busy}>
        Save assignment
      </Button>
    </form>
  );
}
function AvailabilityForm({
  record,
  act,
  busy,
}: {
  record: StaffDetail;
  act: Act;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(record.availability_status);
  return (
    <form
      className="live-staff-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          await staffWrite(
            `/admin/properties/${record.id}/availability`,
            "PATCH",
            { availability_status: selected, version: record.version },
          );
          return "Availability confirmed.";
        });
      }}
    >
      <p>
        Last confirmed:{" "}
        {record.last_availability_confirmed_at
          ? formatStaffDate(record.last_availability_confirmed_at)
          : "Not yet confirmed"}
      </p>
      <Dropdown
        label="Availability"
        value={selected}
        options={["available", "under_offer", "unavailable"].map((v) =>
          option(v),
        )}
        onChange={(e) =>
          setSelected(e.target.value as StaffDetail["availability_status"])
        }
      />
      <p>Saving records the current confirmation time.</p>
      <Button type="submit" loading={busy}>
        Confirm availability
      </Button>
    </form>
  );
}
function MediaItem({
  item,
  record,
  act,
  busy,
}: {
  item: StaffMedia;
  record: StaffDetail;
  act: Act;
  busy: boolean;
}) {
  const [alt, setAlt] = useState(item.alt ?? ""),
    [position, setPosition] = useState(String(item.position)),
    [remove, setRemove] = useState(false),
    [removalFailed, setRemovalFailed] = useState(false);
  return (
    <Panel>
      {item.kind === "photo" ? (
        <img
          className="journey-photo"
          src={item.thumb_url ?? item.url}
          alt={item.alt ?? "Property photo"}
          loading="lazy"
        />
      ) : (
        <video
          controls
          preload="metadata"
          src={item.url}
          className="journey-photo"
        />
      )}
      <p>{item.is_cover ? "Cover photo" : words(item.kind)}</p>
      <form
        className="live-staff-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await staffWrite(
              `/admin/properties/${record.id}/media/${item.id}`,
              "PATCH",
              {
                alt: alt || null,
                position: Number(position),
                version: record.version,
              },
            );
            return "Media details saved.";
          });
        }}
      >
        <Input
          label="Alternative text"
          maxLength={200}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
        />
        <Input
          label="Position"
          type="number"
          min={0}
          step={1}
          required
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Save media details
        </Button>
      </form>
      {item.kind === "photo" && !item.is_cover && (
        <Button
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await staffWrite(
                `/admin/properties/${record.id}/media/${item.id}`,
                "PATCH",
                { is_cover: true, version: record.version },
              );
              return "Cover photo updated.";
            })
          }
        >
          Use as cover
        </Button>
      )}
      <Button
        variant="secondary"
        disabled={
          busy || ["published", "archived", "rejected"].includes(record.status)
        }
        onClick={() => {
          setRemovalFailed(false);
          setRemove(true);
        }}
      >
        Remove {words(item.kind).toLowerCase()}
      </Button>
      <Modal
        open={remove}
        onClose={() => {
          if (!busy) setRemove(false);
        }}
        title="Remove this media item?"
      >
        <p>This removes the item from this property.</p>
        {removalFailed && (
          <p role="alert">
            Unable to remove this item. Close this dialog and reload the record
            before retrying.
          </p>
        )}
        <Button
          disabled={busy}
          onClick={() => {
            setRemovalFailed(false);
            void act(async () => {
              await staffWrite(
                `/admin/properties/${record.id}/media/${item.id}`,
                "DELETE",
              );
              setRemove(false);
              return "Media removed.";
            }).then((ok) => {
              if (!ok) setRemovalFailed(true);
            });
          }}
        >
          Confirm removal
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setRemove(false)}
        >
          Keep media
        </Button>
      </Modal>
    </Panel>
  );
}
function MediaManager({
  record,
  act,
  busy,
  refresh,
}: {
  record: StaffDetail;
  act: Act;
  busy: boolean;
  refresh: () => void;
}) {
  const [kind, setKind] = useState("photo"),
    [file, setFile] = useState<File | null>(null),
    [caption, setCaption] = useState("");
  const frozen = ["published", "archived", "rejected"].includes(record.status);
  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={refresh}>
        Refresh file access
      </Button>
      <form
        className="live-staff-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            if (!file) throw new StaffInputError("Choose a file to upload.");
            if (file.size > (kind === "video" ? 100 : 10) * 1024 * 1024)
              throw new StaffInputError("This file exceeds the upload limit.");
            const body = new FormData();
            body.set("file", file);
            body.set("kind", kind);
            if (caption) body.set("caption", caption);
            await staffWrite(
              `/admin/properties/${record.id}/media`,
              "POST",
              body,
            );
            setFile(null);
            setCaption("");
            return "File uploaded.";
          });
        }}
      >
        <h2>Add media or evidence</h2>
        <Dropdown
          label="File kind"
          value={kind}
          options={[
            "photo",
            "video",
            "ownership_proof",
            "authorization_letter",
            "id_document",
            "other",
          ].map((v) => option(v))}
          onChange={(e) => {
            setKind(e.target.value);
            setFile(null);
          }}
        />
        <Input
          key={kind}
          label="Choose file"
          type="file"
          required
          disabled={frozen || busy}
          accept={
            kind === "photo"
              ? "image/jpeg,image/png,image/webp"
              : kind === "video"
                ? "video/mp4,video/webm"
                : "application/pdf,image/jpeg,image/png"
          }
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p>
          {kind === "video"
            ? "MP4 or WebM, up to 100 MB. One video per property."
            : kind === "photo"
              ? "JPEG, PNG or WebP, up to 10 MB each. Up to 20 photos."
              : "PDF, JPEG or PNG, up to 10 MB each. Evidence is private."}
        </p>
        <Input
          label="Caption (optional)"
          maxLength={200}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <Button type="submit" loading={busy} disabled={busy || frozen}>
          Upload file
        </Button>
        {frozen && (
          <p>
            Unpublish or reopen this property before adding or removing files.
          </p>
        )}
      </form>
      <h2>Property media</h2>
      {record.media.length ? (
        <div className="live-staff-grid">
          {record.media.map((item) => (
            <MediaItem
              key={`${item.id}-${record.version}`}
              item={item}
              record={record}
              act={act}
              busy={busy}
            />
          ))}
        </div>
      ) : (
        <Panel>
          <p>No photos or video have been uploaded.</p>
        </Panel>
      )}
      <h2>Private evidence</h2>
      {record.documents.length ? (
        record.documents.map((doc) => (
          <Panel key={doc.id}>
            <h3>{words(doc.kind)}</h3>
            <p>{doc.review_note}</p>
            <a
              className={buttonStyles()}
              href={doc.signed_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {words(doc.kind).toLowerCase()}
            </a>
            <p>
              Access expires {formatStaffDate(doc.expires_at, "time")}. Refresh
              file access for a new link.
            </p>
          </Panel>
        ))
      ) : (
        <Panel>
          <p>No evidence documents have been uploaded.</p>
        </Panel>
      )}
    </>
  );
}

function PropertyView({
  view,
  id,
  options,
}: {
  view: string;
  id: string;
  options: StaffOptions | null;
}) {
  const resource = useStaffResource<StaffDetail>(
    `/admin/properties/${encodeURIComponent(id)}`,
  );
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const act: Act = async (job) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setNotice(await job());
      resource.reload();
      return true;
    } catch (cause) {
      setError(errorText(cause));
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (resource.loading) return <BrandLoading />;
  if (resource.error)
    return <LoadError error={resource.error} retry={resource.reload} />;
  const record = resource.data;
  if (!record) return null;
  return (
    <>
      <Link href="/staff/properties">Back to properties</Link>
      <h1>{record.title}</h1>
      <p>
        {words(record.status)} · {record.submission_reference ?? "Draft"} ·
        Version {record.version}
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <Panel>
          <p role="alert">{error}</p>
          <Button onClick={resource.reload}>Reload record</Button>
        </Panel>
      )}
      {view !== "property" && (
        <Link href={staffLink("property", id)}>Property details</Link>
      )}
      {![
        "edit-property",
        "assign-review",
        "availability",
        "media",
        "evidence",
        "remove-media",
        "document",
        "document-expired",
      ].includes(view) && (
        <WorkflowPanel
          key={record.version}
          record={record}
          act={act}
          busy={busy}
        />
      )}
      {view === "edit-property" ? (
        <EditProperty record={record} options={options} act={act} busy={busy} />
      ) : view === "assign-review" ? (
        <Assign record={record} options={options} act={act} busy={busy} />
      ) : view === "availability" ? (
        <AvailabilityForm record={record} act={act} busy={busy} />
      ) : [
          "media",
          "evidence",
          "remove-media",
          "document",
          "document-expired",
        ].includes(view) ? (
        <MediaManager
          record={record}
          act={act}
          busy={busy}
          refresh={resource.reload}
        />
      ) : (
        <PropertyRecord record={record} />
      )}
    </>
  );
}
function OwnerView({ id }: { id: string }) {
  const resource = useStaffResource<StaffOwnerDetail>(
    `/admin/landlords/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <Link href="/staff/landlords">Back to landlords</Link>
      <h1>Landlord record</h1>
      {resource.loading ? (
        <BrandLoading />
      ) : resource.error ? (
        <LoadError error={resource.error} retry={resource.reload} />
      ) : (
        resource.data && (
          <>
            <OwnerCard owner={resource.data} />
            <h2>Properties</h2>
            {resource.data.properties.length ? (
              resource.data.properties.map((record) => (
                <RecordLink key={record.id} record={record} />
              ))
            ) : (
              <p>No properties submitted.</p>
            )}
          </>
        )
      )}
    </>
  );
}
export function LiveStaffWorkspace({ view }: { view: string }) {
  const params = useSearchParams(),
    id = params.get("id");
  const { role } = useLocalAccess();
  const [menu, setMenu] = useState(false);
  const options = useStaffResource<StaffOptions>(view === "overview" ? null : "/admin/property-options");
  return (
    <main id="main-content" className="journey-screen staff-preview staff-live">
      <header className="journey-header">
        <p>Kof’a workspace</p>
        <div>
          <Link href="/staff/overview" aria-label="Kof’a staff overview">
            <Image
              src="/assets/client-logo.svg"
              width={101}
              height={33}
              alt="Kof’a"
              className="staff-brand"
            />
          </Link>
          <Button variant="subtle" onClick={() => setMenu(true)}>
            Menu
          </Button>
        </div>
      </header>
      <div className="journey-scroll">
        <div className="journey-body">
          {!!options.error && (
            <LoadError error={options.error} retry={options.reload} />
          )}
          {view === "overview" ? (
            <Overview />
          ) : ["properties", "landlords"].includes(view) ? (
            <>
              <h1>
                {view === "landlords"
                  ? "Landlord directory"
                  : "Property submissions"}
              </h1>
              <Queue view={view} options={options.data} />
            </>
          ) : !id ? (
            <Panel>
              <h1>Choose a {view === "landlord" ? "landlord" : "property"}</h1>
              <p>Open a record from the directory to continue.</p>
              <Link
                className={buttonStyles()}
                href={
                  view === "landlord" ? "/staff/landlords" : "/staff/properties"
                }
              >
                Open directory
              </Link>
            </Panel>
          ) : view === "landlord" ? (
            <OwnerView key={id} id={id} />
          ) : (
            <PropertyView
              key={`${view}-${id}`}
              view={view}
              id={id}
              options={options.data}
            />
          )}
        </div>
      </div>
      <nav aria-label="Staff mobile navigation" className="journey-nav">
        {[
          ["Overview", "overview", "home"],
          ["Properties", "properties", "search"],
          ["Landlords", "landlords", "account"],
        ].map(([label, target, icon]) => (
          <Link
            key={target}
            href={staffLink(target)}
            aria-current={view === target ? "page" : undefined}
          >
            <Image
              src={`/assets/mobile-${icon}.svg`}
              width={22}
              height={22}
              alt=""
            />
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => setMenu(true)}>
          <Image
            src="/assets/mobile-account-active.svg"
            width={22}
            height={22}
            alt=""
          />
          Menu
        </button>
      </nav>
      <Modal open={menu} onClose={() => setMenu(false)} title="Workspace">
        <div className="live-staff-stack">
          {[
            ["Overview", "/staff/overview"],
            ["Properties", "/staff/properties"],
            ["Landlords", "/staff/landlords"],
            ["Inquiries", "/staff/inquiries"],
            ["Complaints", "/staff/complaints"],
        ["Inspections", "/staff/inspections"],
            ["Calendar", "/staff/calendar"],
            ["Account", "/account"],
          ].map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setMenu(false)}>
              {label}
            </Link>
          ))}
          {role === "admin" && (
            <Link href="/admin/overview" onClick={() => setMenu(false)}>
              Administration and team
            </Link>
          )}
        </div>
      </Modal>
    </main>
  );
}
