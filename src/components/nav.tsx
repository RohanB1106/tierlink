"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN: [string, string][] = [
  ["/#services", "What we do"],
  ["/#how", "How it works"],
  ["/demo", "Live demo"],
  ["/chatbot", "Chatbot"],
];

// Pages that show the sample company's data.
const DEMO: [string, string][] = [
  ["/demo", "Overview"],
  ["/review", "Review"],
  ["/consolidation", "Buy together"],
  ["/market", "Market prices"],
  ["/products", "True cost"],
  ["/platform", "Platforming"],
  ["/parts", "Parts"],
  ["/chatbot", "Chatbot"],
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function NavLinks() {
  const path = usePathname();
  const inDemo = DEMO.some(([h]) => isActive(path, h));
  return (
    <>
      <div className="order-last -mx-2.5 flex w-full items-center gap-x-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
        {MAIN.map(([href, label]) => {
          const active = href === "/demo" ? inDemo && path !== "/chatbot" : isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${
                active
                  ? "font-medium text-violet-700 dark:text-violet-300"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <Link href="/contact" className="ml-auto whitespace-nowrap rounded-lg bg-violet-600 px-3.5 py-1.5 font-medium text-white hover:bg-violet-700">
        Free savings review
      </Link>
    </>
  );
}

/** Second bar shown only on demo pages, so visitors know it's sample data. */
export function DemoBar() {
  const path = usePathname();
  if (!DEMO.some(([h]) => isActive(path, h))) return null;
  return (
    <div className="border-t border-neutral-200 bg-amber-50/70 dark:border-neutral-800 dark:bg-amber-950/20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-1.5 text-sm sm:px-8">
        <span className="mr-2 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Live demo</span> · Prairie Power Tools (made-up company, sample data)
        </span>
        {DEMO.map(([href, label]) => {
          const active = path === href || (href !== "/demo" && isActive(path, href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-2 py-1 ${
                active
                  ? "bg-white font-medium text-violet-700 shadow-sm dark:bg-neutral-900 dark:text-violet-300"
                  : "text-neutral-700 hover:bg-white/70 dark:text-neutral-300 dark:hover:bg-neutral-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
