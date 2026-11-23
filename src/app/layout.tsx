import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Logo } from "@/components/ui";
import { DemoBar, NavLinks } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TierLink: purchasing savings for manufacturers",
  description:
    "TierLink connects a manufacturer's bills of materials to every supplier invoice, then shows where to buy together, pay closer to market and cut duplicate parts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}>
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[var(--background)]/90 backdrop-blur dark:border-neutral-800">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2.5 text-sm sm:px-8" aria-label="Main">
            <Link href="/" className="mr-3 flex items-center gap-2 py-1.5 font-semibold tracking-tight">
              <Logo className="size-5" />
              TierLink
            </Link>
            <NavLinks />
          </nav>
          <DemoBar />
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-500 sm:px-8">
            <span className="flex items-center gap-2">
              <Logo className="size-4" />
              TierLink · Purchasing savings for manufacturers · Champaign, Illinois
            </span>
            <span className="flex flex-wrap gap-x-4">
              <Link href="/demo" className="hover:text-neutral-800 dark:hover:text-neutral-200">Live demo</Link>
              <Link href="/contact" className="hover:text-neutral-800 dark:hover:text-neutral-200">Free savings review</Link>
              <span>Demo uses sample data for a made-up company</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
