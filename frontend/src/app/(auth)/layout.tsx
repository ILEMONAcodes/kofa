import { SiteHeader } from "@/components/common/site-header";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="page-container">
        {children}
      </main>
    </>
  );
}
