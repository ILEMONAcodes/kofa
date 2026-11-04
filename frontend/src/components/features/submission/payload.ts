import { parseMoneyInput } from "@/lib/formatters/money";
import type { Taxonomy } from "@/types/filters";
import type { CurrentPolicies } from "@/types/auth";
import { displayValue, type Draft } from "./model";
export class SubmissionInputError extends Error {}
export function submissionPayload(
  d: Draft,
  t: Taxonomy,
  policies: CurrentPolicies,
) {
  const fail = (message: string): never => {
    throw new SubmissionInputError(message);
  };
  const choose = (key: string, values: readonly string[], label: string) => {
    const value = displayValue(d, key).trim();
    return (
      values.find((v) => v.toLowerCase() === value.toLowerCase()) ??
      fail(
        `Choose an available ${label}. Add any extra preferences to the property description.`,
      )
    );
  };
  const area = t.areas.find(
    (a) =>
      [a.id, a.slug, a.neighbourhood].some(
        (v) => v.toLowerCase() === displayValue(d, "area").trim().toLowerCase(),
      ) &&
      a.state.toLowerCase() === displayValue(d, "state").trim().toLowerCase() &&
      a.city.toLowerCase() === displayValue(d, "city").trim().toLowerCase(),
  );
  if (!area)
    fail(
      "Choose a location and neighbourhood from the available listing areas.",
    );
  const amount = parseMoneyInput(d.price ?? "");
  if (amount === null || amount < 100000)
    fail("Enter a price of at least ₦1,000.");
  const relationship = choose(
    "relationship",
    ["owner", "authorized_agent", "developer", "property_manager"],
    "relationship to the property",
  );
  const listingType = choose(
    "listing_type",
    t.listing_types,
    "rent or sale option",
  );
  const number = (key: string) => {
    const v = displayValue(d, key).trim();
    if (!/^\d+$/.test(v) || Number(v) > 20)
      fail(`Enter ${key} as a whole number from 0 to 20.`);
    return Number(v);
  };
  const codes = (d.amenities ?? "")
    .split(",")
    .filter((v) => v && v !== "other")
    .map(
      (v) =>
        t.amenities.find((a) => a.code === v || a.label === v)?.code ??
        fail("Choose amenities from the available options."),
    );
  const conditions = [
    d.conditions?.trim(),
    d.amenities?.split(",").includes("other") && d.amenitiesOther?.trim()
      ? `Other amenities: ${d.amenitiesOther.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (conditions.length > 2000)
    fail(
      "Landlord conditions and other amenities must total no more than 2,000 characters.",
    );
  const charge = parseMoneyInput(d.charge ?? "");
  const chargeLabel = d.charge_label
    ? displayValue(d, "charge_label").trim()
    : "";
  if (!!chargeLabel !== (charge !== null))
    fail(
      "Supply both an additional charge label and its amount, or leave both empty.",
    );
  return {
    landlord: {
      full_name: d.full_name.trim(),
      phone: d.phone.trim(),
      email: d.email?.trim() || null,
      relationship,
    },
    property: {
      title: d.title.trim(),
      description: d.description.trim(),
      listing_type: listingType,
      property_type: choose("property_type", t.property_types, "property type"),
      intended_use: "residential",
      area_id: area!.id,
      address_line: d.address.trim(),
      address_hint: d.hint?.trim() || null,
      price: {
        amount: amount!,
        currency: "NGN",
        period:
          listingType === "sale"
            ? "one_time"
            : choose("period", ["month", "year"], "rent period"),
      },
      price_negotiable: d.negotiable === "yes",
      payment_terms: displayValue(d, "payment_terms"),
      extra_charges: chargeLabel
        ? [{ label: chargeLabel, amount: charge!, currency: "NGN" }]
        : [],
      bedrooms: number("bedrooms"),
      bathrooms: number("bathrooms"),
      furnishing: choose("furnishing", t.furnishing, "furnishing option"),
      amenity_codes: codes,
      availability_status: choose(
        "availability",
        t.availability_statuses,
        "availability option",
      ),
      landlord_conditions: conditions || null,
    },
    accepted_policies: policies.policies.map(({ type, version }) => ({
      type,
      version,
    })),
  };
}
