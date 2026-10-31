import Link from "next/link";
import Image from "next/image";
export function SiteHeader() {
  return (
    <header className="border-b bg-surface">
      <div className="mx-auto flex max-w-workspace flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
        <Link href="/" aria-label="Kof’a home">
          <Image
            src="/assets/kofa-logo.svg"
            alt="Kof’a"
            width={116}
            height={38}
            priority
          />
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-5 text-sm"
        >
          <Link href="/properties">Explore properties</Link>
          <Link href="/landlord">List your property</Link>
          <Link href="/account">My account</Link>
          <Link href="/staff/login">Staff sign in</Link>
        </nav>
      </div>
    </header>
  );
}
