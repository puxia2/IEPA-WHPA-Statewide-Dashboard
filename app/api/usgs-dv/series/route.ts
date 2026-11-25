import { NextResponse } from "next/server";

import { queryUsgsSeries } from "@/lib/usgs-dv-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SITES = 20;

function stridePoints(times: number[], values: number[], maxPoints: number) {
  const count = times.length;
  if (!maxPoints || count <= maxPoints) {
    return times.map((time, index) => ({ time, value: values[index] }));
  }

  const step = Math.ceil(count / maxPoints);
  const points: { time: number; value: number }[] = [];
  for (let index = 0; index < count; index += step) {
    points.push({ time: times[index], value: values[index] });
  }
  const last = count - 1;
  if (points[points.length - 1]?.time !== times[last]) {
    points.push({ time: times[last], value: values[last] });
  }
  return points;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteIds = url.searchParams.getAll("site").map((site) => site.trim()).filter(Boolean);
  const parameterKeys = url.searchParams
    .getAll("parameter")
    .map((key) => key.trim())
    .filter(Boolean);
  const maxPointsRaw = Number(url.searchParams.get("maxPoints") ?? "");
  const maxPoints =
    Number.isFinite(maxPointsRaw) && maxPointsRaw > 0
      ? Math.min(Math.floor(maxPointsRaw), 20000)
      : 0;

  if (!siteIds.length) {
    return NextResponse.json({ series: [] });
  }
  if (siteIds.length > MAX_SITES) {
    return NextResponse.json(
      { error: `Select ${MAX_SITES} or fewer sites to plot` },
      { status: 400 },
    );
  }

  try {
    const matches = await queryUsgsSeries({ siteIds, parameterKeys });
    const series = matches.map((item) => ({
      monitoring_location_id: item.monitoring_location_id,
      parameter_code: item.parameter_code,
      statistic_id: item.statistic_id,
      unit_of_measure: item.unit_of_measure,
      label: item.label,
      points: stridePoints(item.times, item.values, maxPoints),
    }));
    return NextResponse.json(
      { series },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    console.error("[api/usgs-dv/series] failed:", err);
    return NextResponse.json(
      { error: "Failed to read usgs_DV_results.parquet" },
      { status: 500 },
    );
  }
}
