import { SiteHeader } from "@/components/common/site-header";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="desktop-only">
        <SiteHeader />
      </div>
      <main id="main-content" className="auth-main">
        {children}
      </main>
    </>
  );
}
