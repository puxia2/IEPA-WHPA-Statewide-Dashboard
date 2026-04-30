"use client";

import dynamic from "next/dynamic";

const ContourMap = dynamic(
  () => import("@/app/dashboard/heatmap/ContourMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export default function ContourMapLoader() {
  return <ContourMap />;
}
