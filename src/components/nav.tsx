"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/review", "Review"],
  ["/consolidation", "Consolidation"],
  ["/market", "Market prices"],
  ["/products", "True cost"],
  ["/platform", "Platforming"],
  ["/parts", "Parts"],
  ["/ask", "Ask"],
];

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {LINKS.map(([href, label]) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 ${
              active
                ? "bg-violet-50 font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
