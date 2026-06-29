"use client";

import { useCsvData } from "@/components/csv-reader";
import { coerceNumber } from "@/lib/date";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SampleCountsBarPlotProps = {
  csvPath?: string;
  siteName: string;
  topN?: number; // top N parameters to display
  height?: number; // height of the plot
};

interface CsvRow {
  Name: string;
  ParamName2?: string;
  Result_Value_ugL?: number | string;
  [k: string]: unknown;
}

function normalizeText(s: unknown) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export default function SampleCountsBarPlot({
  csvPath = "/EStL_AllDataJoin2.csv",
  siteName,
  topN = 10,
  height = 300,
}: SampleCountsBarPlotProps) {
  const { rows, loading, error } = useCsvData<CsvRow>(csvPath);

  const data = useMemo(() => {
    const siteNorm = normalizeText(siteName);
    if (!siteNorm || !rows.length) return [];

    const counts = new Map<string, number>();

    for (const row of rows) {
      const rowSite = normalizeText(row.Name);
      if (!rowSite || rowSite !== siteNorm) continue;

      const paramNorm = normalizeText(row.ParamName2);
      if (!paramNorm) continue;

      if (coerceNumber(row.Result_Value_ugL) === null) continue;

      counts.set(paramNorm, (counts.get(paramNorm) ?? 0) + 1);
    }

    const out = Array.from(counts.entries())
      .map(([param, count]) => ({ param, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);

    return out;
  }, [rows, siteName, topN]);

  return (
    <div className="w-full">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">
          Top {topN} sample counts by parameter:
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading data…</div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="w-full rounded-2xl border p-3" style={{ height }}>
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 6, right: 12, bottom: 6, left: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="count"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="param"
                width={200}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => [value, "Count"]}
                labelFormatter={(label) => `Param: ${label}`}
              />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data found for this site.
          </div>
        )}
      </div>
    </div>
  );
}
