import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { InlineScript } from "@/components/inline-script";
import "./globals.css";

// Fonts ship with the framer design skill; loaded locally, no network request.
const geist = localFont({
  src: "./fonts/GeistVariable-Regular.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const garamond = localFont({
  src: [
    { path: "./fonts/EBGaramond-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/EBGaramond-Medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aurum · Portfolio",
  description: "An AI-first portfolio dashboard. Mock data. Not financial advice.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${garamond.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Hide entrance-animated elements before first paint, unless motion is reduced. */}
        <InlineScript html="var h=document.documentElement;h.classList.add(matchMedia('(prefers-reduced-motion: reduce)').matches?'motion-reduce':'motion-ok');try{if(localStorage.getItem('aurum.portfolio.v1'))h.classList.add('portfolio-pending')}catch(e){}" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
