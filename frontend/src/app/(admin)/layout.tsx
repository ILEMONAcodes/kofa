import Link from "next/link";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="bg-primary p-6 text-inverse">
        <Link href="/" className="text-2xl font-medium">
          Kof’a
        </Link>
        <p className="mt-6 text-sm">Staff workspace</p>
        <nav aria-label="Staff navigation" className="mt-6">
          <Link href="/admin">Overview</Link>
        </nav>
      </aside>
      <main id="main-content" className="page-container">
        {children}
      </main>
    </div>
  );
}
