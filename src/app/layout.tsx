import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "TierLink",
  description:
    "Link BOMs to supplier spend, normalize volume price breaks, and find consolidation and standardization savings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-5 px-4 py-3 text-sm sm:px-8">
            <Link href="/" className="font-semibold tracking-tight">
              TierLink
            </Link>
            <Link href="/review" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
              Review Queue
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
