import Link from "next/link";
export function Hero() {
  return (
    <section className="rounded-2xl bg-primary px-6 py-12 text-inverse md:px-12 md:py-16">
      <p className="text-sm uppercase tracking-widest">
        Kof’a · The doorway to your home
      </p>
      <h1 className="mt-6 max-w-2xl text-4xl leading-tight md:text-6xl">
        A place to call <span className="font-editorial italic">your own.</span>
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed">
        Explore property listings, understand the checks behind them, and take
        your next step with clarity.
      </p>
      <Link
        href="/properties"
        className="mt-8 inline-flex min-h-12 items-center rounded-full bg-accent px-6 py-3 font-medium text-ink"
      >
        Explore properties{" "}
        <span aria-hidden="true" className="ml-3">
          ↗
        </span>
      </Link>
    </section>
  );
}
