import type { ReactNode } from "react";
export function StatePanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-surface p-6 md:p-8">
      <h2 className="text-xl font-medium">{title}</h2>
      <div className="mt-3 max-w-prose text-muted">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
