"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type LegendPayload,
} from "recharts";
import { TimeSeriesPlotProps } from "@/types/chart";
import { useUsgsSeries } from "@/hooks/use-usgs-dv";

type WidePoint = {
  dateLabel: string; // "MM/DD/YYYY"
  dateMs: number; // timestamp in milliseconds, for X axis calculation & brush
  sort: number; // yyyymmdd, for sorting
  [site: string]: string | number | undefined;
};

function formatUtc(ms: number, withDay: boolean) {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  if (!withDay) return `${month}/${year}`;
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DEFAULT_COLORS = [
  "#b45309", // amber-700
  "#0f766e", // teal-700
  "#7c3aed", // violet-700
  "#2563eb", // blue-600
  "#ef4444", // red-500
  "#16a34a", // green-600
];

// Daily values are dense. Keep the line readable without drawing a dot per day.
const MAX_POINTS = 4000;

export function TimeSeriesPlotDatestamp({
  targetParam,
  sites,
  colors = {},
  height = 440,
  compact = false,
  xDomain,
  onInitialDomain,
}: TimeSeriesPlotProps) {
  const parameterKeys = targetParam ? [targetParam] : [];
  const { series, loading, error } = useUsgsSeries(
    sites,
    parameterKeys,
    MAX_POINTS,
  );

  const data: WidePoint[] = useMemo(() => {
    const bucket = new Map<number, WidePoint>();

    for (const item of series) {
      const site = item.monitoring_location_id;
      for (const point of item.points) {
        let row = bucket.get(point.time);
        if (!row) {
          row = {
            dateLabel: formatUtc(point.time, true),
            dateMs: point.time,
            sort: point.time,
          };
          bucket.set(point.time, row);
        }
        row[site] = point.value;
      }
    }

    return Array.from(bucket.values()).sort((a, b) => a.sort - b.sort);
  }, [series]);

  const yLabel = series[0]?.label || "Value";

  useEffect(() => {
    if (!onInitialDomain) return;
    if (!data.length) return;

    const startDate = data[0].dateMs;
    const endDate = data[data.length - 1].dateMs;
    onInitialDomain([startDate, endDate]);
  }, [data, onInitialDomain]);

  // create a map of site colors
  const siteColor = useMemo(() => {
    const map: Record<string, string> = { ...colors }; //site name -> color
    let i = 0;
    for (const s of sites) {
      if (!map[s]) {
        // if the site color is not provided, use the default colors
        map[s] = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        i += 1;
      }
    }
    return map;
  }, [sites, colors]);

  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const handleLegendClick = (site: string) => {
    setHidden((prev) => ({ ...prev, [site]: !prev[site] }));
  };

  return (
    <div className="flex w-full flex-col gap-2" style={{ height }}>
      <div>
        {/*parameter name*/}
        {/* {!compact && (
          <h1 className="text-2xl font-semibold tracking-tight">
            {targetParam}
          </h1>
        )} */}

        {!compact && (
          <p className="text-lg text-muted-foreground font-bold text-center">
            Site: {sites.join(", ")}
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading daily values…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-red-600">
            {error}
          </div>
        ) : data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="dateMs"
                type="number"
                scale="time"
                domain={xDomain ?? ["auto", "auto"]}
                minTickGap={28}
                tickFormatter={(value: number) => formatUtc(value, false)}
                label={{
                  value: "Date",
                  position: "insideBottomRight",
                  offset: 0,
                  dy: 10,
                  fontWeight: "bold",
                }}
              />
              <YAxis
                label={{
                  value: yLabel,
                  position: "insideMiddle",
                  angle: -90,
                  offset: 0,
                  dx: -30,
                  fontWeight: "bold",
                }}
              />
              <Tooltip
                labelFormatter={(value) => formatUtc(value as number, true)}
              />
              <Legend
                onClick={(o) => {
                  const payload = o as LegendPayload;
                  const site =
                    typeof payload.value === "string"
                      ? payload.value
                      : undefined;
                  if (!site) return;
                  handleLegendClick(site);
                }}
              />
              {sites.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={s}
                  stroke={siteColor[s]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                  hide={hidden[s]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data found
          </div>
        )}
      </div>
    </div>
  );
}
