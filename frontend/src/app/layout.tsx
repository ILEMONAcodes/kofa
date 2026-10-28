import type { Metadata } from "next";
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
export const metadata: Metadata = {
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
        {children}
      </body>
    </html>
  );
}
