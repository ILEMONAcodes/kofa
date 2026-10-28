"use client";
import { Input } from "@/components/common/input";
import { Button } from "@/components/common/button";
import { formatMoney, parseMoneyInput } from "@/lib/formatters/money";
export function SearchBudget({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  let amount: number | null = null;
  let error: string | undefined;
  try {
    amount = parseMoneyInput(value);
  } catch {
    error = "Enter a valid amount with up to two decimal places.";
  }
  function step(direction: number) {
    if (error) return;
    const next = Math.max(0, (amount ?? 0) + direction * 10000000);
    if (Number.isSafeInteger(next)) onChange(formatMoney(next).slice(1));
  }
  return (
    <div className="search-budget">
      <div className="search-money-field">
        <span aria-hidden="true" className="search-money-symbol">
          ₦
        </span>
        <Input
          label={label}
          labelClassName="home-field-label"
          className="search-money-input"
          inputMode="decimal"
          value={value}
          onBlur={() => {
            if (amount !== null && !error)
              onChange(formatMoney(amount).slice(1));
          }}
          onChange={(event) => onChange(event.target.value)}
          error={error}
        />
      </div>
      <div className="home-budget-stepper">
        <Button
          variant="secondary"
          className="w-12 shrink-0"
          aria-label={`Decrease ${label.toLowerCase()} by 100,000 naira`}
          disabled={!!error || amount === 0}
          onClick={() => step(-1)}
        >
          −
        </Button>
        <p className="text-home-caption text-muted">₦100,000 / step</p>
        <Button
          variant="secondary"
          className="w-12 shrink-0"
          aria-label={`Increase ${label.toLowerCase()} by 100,000 naira`}
          disabled={
            !!error ||
            (amount !== null && amount > Number.MAX_SAFE_INTEGER - 10000000)
          }
          onClick={() => step(1)}
        >
          +
        </Button>
      </div>
    </div>
  );
}
