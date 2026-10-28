import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="page-container">
      <h1 className="text-3xl">This doorway leads elsewhere.</h1>
      <p className="mt-4 text-muted">We couldn’t find that page.</p>
      <Link
        href="/properties"
        className="mt-6 inline-block text-primary underline"
      >
        Explore properties
      </Link>
    </main>
  );
}
