"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PopoverSelect } from "@/components/common/popover-select";
import { Input } from "@/components/common/input";
import { Button } from "@/components/common/button";
import { formatMoney, parseMoneyInput } from "@/lib/formatters/money";
import { homeSearchHref } from "@/lib/home-search";
import type { ListingType } from "@/types/property";
export function HomeSearch() {
  const router = useRouter();
  const [city, setCity] = useState("Abuja");
  const [other, setOther] = useState("");
  const [listingType, setListingType] = useState<ListingType>("rent");
  const [budget, setBudget] = useState("5,000,000");
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  let amount: number | null = null;
  let error: string | undefined;
  try {
    amount = parseMoneyInput(budget);
  } catch {
    error = "Enter a valid amount with no more than two decimal places.";
  }
  const otherError =
    submitted && city === "other" && !other.trim()
      ? "Specify your location preference."
      : undefined;
  function step(direction: 1 | -1) {
    if (error) return;
    const next = Math.max(0, (amount ?? 0) + direction * 10000000);
    if (!Number.isSafeInteger(next)) return;
    setBudget(formatMoney(next).slice(1));
  }
  return (
    <section
      id="find-a-home"
      className="home-search-ribbon"
      data-node-id="28:625"
      aria-labelledby="search-title"
    >
      <h2 id="search-title" className="text-home-title">
        Find a place that feels like you.
      </h2>
      <form
        className="home-search-controls"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (error || (city === "other" && !other.trim())) return;
          router.push(
            homeSearchHref({ city, other, listingType, budget: amount }),
          );
        }}
      >
        <div className="home-location">
          <PopoverSelect
            label="Where"
            title="City"
            description="Choose an option, or Other to specify."
            value={city}
            onChange={setCity}
            options={[
              { value: "Abuja", label: "Abuja" },
              { value: "other", label: "Other" },
            ]}
          />
          {city === "other" && (
            <div className="mt-2">
              <Input
                label="Specify your preference"
                value={other}
                onChange={(event) => setOther(event.target.value)}
                error={otherError}
                hint="Your preference will be used as a text search. Availability depends on listed properties."
                labelClassName="home-field-label"
              />
            </div>
          )}
        </div>
        <PopoverSelect
          label="Looking to"
          title="Transaction type"
          description="Choose an available option."
          value={listingType}
          onChange={(value) => setListingType(value as ListingType)}
          options={[
            { value: "rent", label: "Rent" },
            { value: "sale", label: "Buy" },
          ]}
        />
        <div className="home-budget">
          <Input
            label={listingType === "rent" ? "Budget / year" : "Budget"}
            labelClassName="home-field-label"
            inputMode="decimal"
            value={
              editing
                ? budget
                : amount !== null && !error
                  ? `Up to ${formatMoney(amount)}`
                  : budget
            }
            onFocus={() => setEditing(true)}
            onBlur={() => {
              setEditing(false);
              if (amount !== null && !error)
                setBudget(formatMoney(amount).slice(1));
            }}
            onChange={(event) => setBudget(event.target.value)}
            error={error}
          />
          <div className="home-budget-stepper">
            <Button
              variant="secondary"
              className="h-12 w-12 shrink-0"
              aria-label="Decrease budget by 100,000 naira"
              disabled={Boolean(error) || amount === 0}
              onClick={() => step(-1)}
            >
              −
            </Button>
            <p className="text-home-caption text-muted">₦100,000 / step</p>
            <Button
              variant="secondary"
              className="h-12 w-12 shrink-0"
              aria-label="Increase budget by 100,000 naira"
              disabled={
                Boolean(error) ||
                (amount !== null && amount > Number.MAX_SAFE_INTEGER - 10000000)
              }
              onClick={() => step(1)}
            >
              +
            </Button>
          </div>
        </div>
        <div className="home-search-action">
          <p className="text-sm text-muted">Your next step</p>
          <Button type="submit" className="w-full">
            Find my home ↗
          </Button>
        </div>
      </form>
    </section>
  );
}
