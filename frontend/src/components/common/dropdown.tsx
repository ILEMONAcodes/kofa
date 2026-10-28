import { useId, type SelectHTMLAttributes } from "react";
import type { SelectOption } from "@/types/filters";
import { cn } from "@/lib/cn";
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: readonly SelectOption[];
  error?: string;
};
// Native select provides platform keyboard/screen-reader behavior and a persistent chevron.
export function Dropdown({
  label,
  options,
  error,
  id,
  className,
  ...props
}: Props) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          {...props}
          id={selectId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={
            [props["aria-describedby"], error && `${selectId}-error`]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn("field-control appearance-none pr-12", className)}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-primary"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
