import type { PropertyPrice } from "@/types/api";
import type { Furnishing } from "@/types/property";
import { formatMoney } from "./formatters/money";
export function listingPrice(price: PropertyPrice): string {
  return `${formatMoney(price.amount)}${price.period === "one_time" ? "" : ` /${price.period}`}`;
}
export function pricePeriodLabel(price: PropertyPrice): string {
  return price.period === "one_time"
    ? "For sale"
    : price.period === "month"
      ? "per month"
      : "per year";
}
export const furnishingLabel: Record<Furnishing, string> = {
  furnished: "Furnished",
  semi_furnished: "Semi-furnished",
  unfurnished: "Unfurnished",
};
