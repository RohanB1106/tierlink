"use client";

import dynamic from "next/dynamic";
import type { ViewerProps } from "./viewer";

// three.js needs the browser (WebGL), so the viewer is never server-rendered.
const Viewer = dynamic(() => import("./viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => (
    <div className="mt-4 flex h-[420px] items-center justify-center rounded-xl border border-neutral-200 text-sm text-neutral-500 sm:h-[480px] dark:border-neutral-800">
      Loading 3D view…
    </div>
  ),
});

export function ViewerLoader(props: ViewerProps) {
  return <Viewer {...props} />;
}
