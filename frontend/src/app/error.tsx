"use client";
import { Button } from "@/components/common/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="page-container">
      <h1 className="text-3xl">Something went wrong.</h1>
      <p className="my-6 text-muted">Please try loading this page again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
