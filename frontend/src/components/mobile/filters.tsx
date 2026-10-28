"use client";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
function subscribe(callback: () => void) {
  const media = matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function useMobile() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}
export function ResponsiveFilters({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const mobile = useMobile();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!mobile || !open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [mobile, open]);
  return mobile ? (
    <dialog
      ref={ref}
      className="mobile-filter-dialog"
      aria-label="Make it your search"
      onCancel={onClose}
    >
      {children}
    </dialog>
  ) : (
    <div className="desktop-filter-wrapper">{children}</div>
  );
}
