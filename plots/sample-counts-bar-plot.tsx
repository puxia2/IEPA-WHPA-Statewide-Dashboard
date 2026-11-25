"use client";

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
  counts: { param: string; count: number }[];
  topN?: number; // top N parameters to display
  height?: number; // height of the plot
};

export default function SampleCountsBarPlot({
  counts,
  topN = 10,
  height = 300,
}: SampleCountsBarPlotProps) {
  const data = useMemo(() => {
    return counts
      .filter((item) => item.param && item.count > 0)
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }, [counts, topN]);

  return (
    <div className="w-full">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">
          Daily values by parameter:
        </p>
      </div>

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
