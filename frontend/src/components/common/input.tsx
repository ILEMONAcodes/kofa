import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  labelClassName?: string;
};
export function Input({
  label,
  error,
  hint,
  id,
  className,
  labelClassName,
  ...props
}: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const description =
    [
      props["aria-describedby"],
      hint && `${inputId}-hint`,
      error && `${inputId}-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={cn("block text-sm font-medium", labelClassName)}
      >
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={description}
        className={cn("field-control", error && "border-danger", className)}
      />
      {hint && (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
