import {
  LocalAccessProvider,
  AccessStatus,
} from "@/components/access/local-access";
import { MobileAppChrome } from "@/components/mobile/app-shell";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
const dmSans = localFont({
  src: "../assets/fonts/dm-sans-latin-variable.woff2",
  variable: "--font-dm-sans",
  adjustFontFallback: false,
  weight: "100 1000",
  display: "swap",
});
const instrumentSerif = localFont({
  src: [
    {
      path: "../assets/fonts/instrument-serif-latin-400-normal.woff2",
      style: "normal",
      weight: "400",
    },
    {
      path: "../assets/fonts/instrument-serif-latin-400-italic.woff2",
      style: "italic",
      weight: "400",
    },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#643B29",
};
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { apple: "/assets/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kof’a" },
  title: {
    default: "Kof’a — The doorway to your home",
    template: "%s | Kof’a",
  },
  description:
    "Explore property listings and understand the verification checks behind them.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-NG"
      className={`${dmSans.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-surface focus:p-4"
        >
          Skip to content
        </a>
        <noscript>
          <style>{`#app-content,.mobile-launch,.mobile-bottom-nav{display:none!important}`}</style>
          <main id="no-script-content" className="page-container">
            <h1 className="text-3xl">Welcome to Kof’a</h1>
            <p className="mt-4 text-muted">
              Enable JavaScript to use property search, filters and the app
              navigation.
            </p>
          </main>
        </noscript>
        <LocalAccessProvider>
          <AccessStatus />
          <div id="app-content">{children}</div>
          <MobileAppChrome />
        </LocalAccessProvider>
      </body>
    </html>
  );
}
