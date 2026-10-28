"use client";
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SelectOption } from "@/types/filters";
import { Button } from "./button";
interface Props {
  multiple?: boolean;
  chevronAsset?: string;
  label: string;
  title: string;
  description: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}
export function PopoverSelect({
  multiple = false,
  chevronAsset,
  label,
  title,
  description,
  value,
  options,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pendingFocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (open && pendingFocus.current !== null) {
      focusOption(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [open]);
  const selected = value.split(",").filter(Boolean);
  const current =
    multiple && selected.length
      ? selected
          .map((v) => options.find((o) => o.value === v)?.label ?? v)
          .join(", ")
      : (options.find((option) => option.value === value)?.label ??
        (value || "Choose an option"));
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  function focusOption(index: number) {
    const list =
      root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    list?.[Math.max(0, Math.min(index, list.length - 1))]?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ??
          [],
      );
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (!open) {
        pendingFocus.current =
          event.key === "ArrowUp" || event.key === "End"
            ? options.length - 1
            : Math.max(
                0,
                options.findIndex((o) => o.value === value),
              );
        setOpen(true);
      } else
        focusOption(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : index + (event.key === "ArrowDown" ? 1 : -1),
        );
    }
  }
  function select(next: string) {
    if (multiple) {
      onChange(
        next === ""
          ? ""
          : (selected.includes(next)
              ? selected.filter((v) => v !== next)
              : [...selected, next]
            ).join(","),
      );
      return;
    }
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  }
  const regular = options.filter((option) => option.value !== "other");
  const other = options.find((option) => option.value === "other");
  return (
    <div
      ref={root}
      className="home-select"
      onKeyDown={keyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="home-field-label">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        className={`field-control text-left${chevronAsset ? " select-with-vector" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{current}</span>{" "}
        {chevronAsset ? (
          // eslint-disable-next-line @next/next/no-img-element -- Exact exported Figma vector.
          <img
            src={chevronAsset}
            width="20"
            height="20"
            alt=""
            className="select-chevron"
          />
        ) : (
          <span aria-hidden="true">▾</span>
        )}
      </button>
      {open && (
        <div className="home-select-menu">
          <div className="home-menu-heading">
            <p className="text-home-card text-primary">{title}</p>
            <p className="text-sm text-muted">{description}</p>
          </div>
          <div
            id={`${id}-options`}
            role="listbox"
            aria-label={title}
            aria-multiselectable={multiple || undefined}
            className="home-menu-options"
          >
            <div className="home-menu-regular">
              {regular.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={
                    multiple
                      ? selected.includes(option.value) ||
                        (!value && !option.value)
                      : value === option.value
                  }
                  disabled={option.disabled}
                  className="home-menu-option"
                  onClick={() => select(option.value)}
                >
                  {multiple && option.value && (
                    <span aria-hidden="true">
                      {selected.includes(option.value) ? "☑ " : "☐ "}
                    </span>
                  )}
                  {option.label}
                </button>
              ))}
            </div>
            {other && (
              <div className="home-menu-other">
                <button
                  type="button"
                  role="option"
                  aria-selected={
                    multiple ? selected.includes("other") : value === "other"
                  }
                  className="home-menu-option"
                  onClick={() => select("other")}
                >
                  {other.label}
                </button>
              </div>
            )}
          </div>
          <div
            className={
              other
                ? "home-menu-actions home-menu-actions-with-other"
                : "home-menu-actions"
            }
          >
            <Button
              variant="subtle"
              className="w-full"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              {multiple ? "Apply choices" : "Close"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
