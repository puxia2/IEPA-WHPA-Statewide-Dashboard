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
  Brush,
  Legend,
} from "recharts";
import dayjs from "dayjs";
import { useCsvData } from "@/components/csv-reader";
import { TimeSeriesPlotProps } from "@/types/chart";
import { coerceNumber, mdySortKey, toMDY } from "@/lib/date";

type WidePoint = {
  dateLabel: string; // "MM/DD/YYYY"
  dateMs: number; // timestamp in milliseconds, for X axis calculation & brush
  sort: number; // yyyymmdd, for sorting
  [site: string]: string | number | undefined;
};

const DEFAULT_COLORS = [
  "#b45309", // amber-700
  "#0f766e", // teal-700
  "#7c3aed", // violet-700
  "#2563eb", // blue-600
  "#ef4444", // red-500
  "#16a34a", // green-600
];

export function TimeSeriesPlotDatestamp({
  targetParam,
  sites,
  csvPath = "/EStL_AllDataJoin.csv",
  colors = {},
  height = 440,
  compact = false,
  xDomain,
  onInitialDomain,
}: TimeSeriesPlotProps) {
  const { rows } = useCsvData<any>(csvPath);

  const data: WidePoint[] = useMemo(() => {
    const bucket = new Map<string, Map<string, number[]>>();

    for (const r of rows) {
      // Filter by targetParam first (like time-series-plot.tsx does)
      if (r.ParamName !== targetParam) continue;

      const mdy = toMDY(String(r.Start_Date ?? ""));
      if (!mdy) continue;

      const v = coerceNumber(r.Result_Value as unknown);
      if (v === null) continue;

      const site = String(r.Name ?? "");
      if (!sites.includes(site)) continue;

      let inner = bucket.get(mdy);
      if (!inner) {
        inner = new Map();
        bucket.set(mdy, inner);
      }
      const arr = inner.get(site) ?? [];
      arr.push(v);
      inner.set(site, arr);
    }

    const out: WidePoint[] = [];
    for (const [mdy, inner] of bucket) {
      const sort = mdySortKey(mdy);
      if (sort === null) continue;

      const ms = new Date(mdy).getTime();
      if (!Number.isFinite(ms)) continue;

      const row: WidePoint = { dateLabel: mdy, dateMs: ms, sort };
      for (const s of sites) {
        const arr = inner.get(s);
        if (arr && arr.length) {
          row[s] = arr.reduce((a, b) => a + b, 0) / arr.length;
        }
      }
      out.push(row);
    }

    out.sort((a, b) => a.sort - b.sort);
    return out;
  }, [rows, sites, targetParam]);

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
    <div className="flex h-[440px] w-full flex-col gap-2">
      <div>
        {!compact && (
          <h1 className="text-2xl font-semibold tracking-tight">
            {targetParam}
          </h1>
        )}

        {!compact && (
          <p className="text-sm text-muted-foreground">
            Site: {sites.join(", ")}
          </p>
        )}
      </div>
      <div className="h-[calc(100%-32px)]">
        {data.length ? (
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
                tickFormatter={(value: number) =>
                  dayjs(value).format("MM/YYYY")
                }
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
                  value: targetParam,
                  position: "insideMiddle",
                  angle: -90,
                  offset: 0,
                  dx: -30,
                  fontWeight: "bold",
                }}
              />
              <Tooltip
                labelFormatter={(value) =>
                  dayjs(value as number).format("YYYY-MM-DD")
                }
              />
              <Legend
                onClick={(o) => handleLegendClick((o as any).value as string)}
              />
              {sites.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={s}
                  stroke={siteColor[s]}
                  dot={!compact}
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
