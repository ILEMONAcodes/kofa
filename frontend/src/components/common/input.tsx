import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  prefix?: string;
  error?: string;
  hint?: string;
  labelClassName?: string;
};
export function Input({
  label,
  prefix,
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
  const control = (
    <input
      {...props}
      id={inputId}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={description}
      className={cn(
        "field-control",
        prefix && "input-prefixed",
        error && "border-danger",
        className,
      )}
    />
  );
  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={cn("block text-sm font-medium", labelClassName)}
      >
        {label}
      </label>
      {prefix ? (
        <div className="input-prefix-control">
          <span className="input-prefix-symbol" aria-hidden="true">
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
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
