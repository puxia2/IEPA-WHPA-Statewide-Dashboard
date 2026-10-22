import { RiverLevelPlotProps } from "@/types/chart";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";
import { fetchUsgsRiverDailyDv, type RiverPoint } from "./usgs-water";

// This variant reads the USGS service directly, so it takes no dataset name.
type Props = Omit<RiverLevelPlotProps, "dataset"> & {
  site?: string;
  startDT?: string; // "YYYY-MM-DD"
  endDT?: string; // optional
  parameterCd?: string; // default 00065
  refreshMs?: number; // fixed refresh interval (cache revalidate), default 5min
  statCd?: string; // default 00003
};

export function RiverLevelPlotRealTime({
  height = 220,
  xDomain,
  onDomainChange,

  site = "07010000",
  startDT = "2000-01-01",
  endDT,
  parameterCd = "00065",
  refreshMs = 5 * 60 * 1000,
  statCd = "00003",
}: Props) {
  const { data, error, isLoading } = useSWR(
    ["usgs-daily-mean", site, parameterCd, startDT, endDT ?? "", statCd],
    async () => {
      const series = await fetchUsgsRiverDailyDv({
        site,
        parameterCd,
        startDT,
        endDT,
        statCd,
      });
      if (!series) throw new Error("No USGS data");
      return series;
    },
    {
      refreshInterval: refreshMs, // refresh interval
      dedupingInterval: 60 * 1000, // deduplicate requests within 1 minute
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const plotData: RiverPoint[] = useMemo(() => data ?? [], [data]);

  // ------------------------------------------------------------------
  // minYear, maxYear, yearTicks for x axis ticks (avoid missing years)
  // ------------------------------------------------------------------
  const minYear = plotData.length
    ? new Date(plotData[0].dateMs).getFullYear()
    : 0;
  const maxYear = plotData.length
    ? new Date(plotData[plotData.length - 1].dateMs).getFullYear()
    : 0;

  const yearTicks = useMemo(() => {
    if (!plotData.length) return [];
    const arr: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      arr.push(new Date(y, 0, 1).getTime());
    }
    return arr;
  }, [plotData.length, minYear, maxYear]);

  // Keep brush as local controlled state:
  // - when parent xDomain changes (e.g. marker click), initialize brush to that range
  // - when user drags brush, update local indices immediately and sync to parent
  const [brushRange, setBrushRange] = useState<{
    startIndex?: number;
    endIndex?: number;
  }>({});

  const indicesFromDomain = useMemo(() => {
    if (!xDomain || !plotData.length)
      return { startIndex: undefined, endIndex: undefined };
    const [start, end] = xDomain;

    let startIndex = plotData.findIndex((d) => d.dateMs >= start);
    if (startIndex === -1) startIndex = 0;

    let endIndex = plotData.findIndex((d) => d.dateMs >= end);
    if (endIndex === -1) endIndex = plotData.length - 1;

    return { startIndex, endIndex };
  }, [xDomain, plotData]);

  useEffect(() => {
    setBrushRange(indicesFromDomain);
  }, [indicesFromDomain]);

  if (isLoading) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center text-sm text-muted-foreground">
        Loading river level data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center text-sm text-destructive">
        Failed to load river level data
      </div>
    );
  }

  if (!plotData.length) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center text-sm text-muted-foreground">
        No river level data
      </div>
    );
  }

  return (
    <div className="mt-4 flex w-full flex-col gap-2 p-4" style={{ height }}>
      <div className="flex items-center justify-center h-[32px] font-bold text-2xl">
        Daily Mississippi River Water Level (ft)
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={plotData}
            margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="dateMs"
              type="number"
              scale="time"
              domain={
                xDomain
                  ? xDomain
                  : yearTicks.length
                  ? [yearTicks[0], yearTicks[yearTicks.length - 1]]
                  : ["auto", "auto"]
              }
              ticks={yearTicks.length ? yearTicks : undefined}
              tickFormatter={(value: number) => dayjs(value).format("YYYY")}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) =>
                dayjs(value as number).format("YYYY-MM-DD")
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0f766e"
              strokeWidth={1.5}
              dot={false}
            />
            <Brush
              dataKey="dateMs"
              height={30}
              travellerWidth={10}
              tickFormatter={(value) =>
                dayjs(value as number).format("YYYY-MM")
              }
              startIndex={brushRange.startIndex}
              endIndex={brushRange.endIndex}
              onChange={(e: { startIndex?: number; endIndex?: number }) => {
                if (!e || !onDomainChange) return;
                const { startIndex, endIndex } = e;
                if (
                  typeof startIndex !== "number" ||
                  typeof endIndex !== "number"
                ) {
                  return;
                }
                setBrushRange({ startIndex, endIndex });
                const start = plotData[startIndex]?.dateMs;
                const end = plotData[endIndex]?.dateMs;
                if (start != null && end != null) {
                  onDomainChange([start, end]);
                }
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
