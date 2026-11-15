import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Logo } from "@/components/ui";
import { NavLinks } from "@/components/nav";
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
  title: "TierLink: BOM-to-spend intelligence",
  description:
    "TierLink links a manufacturer's BOMs to every supplier receipt, then finds savings from volume price tiers, market prices and part standardization.",
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
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-neutral-500 sm:px-8">
            <span className="flex items-center gap-2">
              <Logo className="size-4" />
              TierLink · Kearney PERLab Hackathon · Team Double Trouble
            </span>
            <span>Demo data: Prairie Power Tools, a fictional manufacturer</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
