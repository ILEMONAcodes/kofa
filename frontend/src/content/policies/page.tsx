import Link from "next/link";
import { policyDrafts } from "./drafts";

export function PolicyDraftPage({ type }: { type: keyof typeof policyDrafts }) {
  const policy = policyDrafts[type];
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
      <nav aria-label="Policy navigation" className="mb-8 flex flex-wrap gap-6 underline underline-offset-4">
        <Link href="/">Kof’a · Home</Link>
        <Link href="/resources/terms">Terms of Service</Link>
        <Link href="/resources/privacy">Privacy Policy</Link>
        <Link href="/register">Registration</Link>
      </nav>
      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold">{policy.title}</h1>
          <p className="text-sm">Version: draft-v1 · Draft updated 2 November 2026</p>
          <aside aria-label="Draft policy notice" className="rounded-xl border border-current p-5">
            Draft — not legal advice. Proposed for review; not approved for public launch.
            A Nigerian lawyer should review this document before launch. Bracketed details remain unresolved.
            Some services described here are planned and are not yet available.
          </aside>
        </header>
        {policy.sections.map(([heading, text]) => (
          <section key={heading} className="space-y-3">
            <h2 className="text-xl font-semibold">{heading}</h2>
            <p className="leading-7">{text}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
