import { NextResponse } from "next/server";

import { getUsgsIndex } from "@/lib/usgs-dv-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const { sites } = await getUsgsIndex();
    return NextResponse.json(
      { sites },
      {
        headers: { "Cache-Control": "private, max-age=300" },
      },
    );
  } catch (err) {
    console.error("[api/usgs-dv/sites] failed:", err);
    return NextResponse.json(
      { error: "Failed to read usgs_DV_results.parquet" },
      { status: 500 },
    );
  }
}
