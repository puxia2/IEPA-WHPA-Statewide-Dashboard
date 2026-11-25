"use client";

import { useEffect, useState } from "react";

import type { UsgsSite } from "@/lib/usgs-dv";

export type UsgsSeriesResult = {
  monitoring_location_id: string;
  parameter_code: string;
  statistic_id: string;
  unit_of_measure: string;
  label: string;
  points: { time: number; value: number }[];
};

async function errorMessage(res: Response) {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // The body was not JSON.
  }
  return res.statusText || `Request failed (${res.status})`;
}

export function useUsgsSites() {
  const [sites, setSites] = useState<UsgsSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/usgs-dv/sites")
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res));
        return (await res.json()) as { sites: UsgsSite[] };
      })
      .then((data) => {
        if (cancelled) return;
        setSites(data.sites ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { sites, loading, error };
}

export function useUsgsSeries(
  siteIds: readonly string[],
  parameterKeys: readonly string[],
  maxPoints?: number,
) {
  const siteKey = siteIds.join(",");
  const parameterKey = parameterKeys.join(",");

  const [series, setSeries] = useState<UsgsSeriesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey || !parameterKey) {
      setSeries([]);
      setError(null);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    for (const site of siteKey.split(",")) params.append("site", site);
    for (const key of parameterKey.split(",").filter(Boolean)) {
      params.append("parameter", key);
    }
    if (maxPoints) params.set("maxPoints", String(maxPoints));

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/usgs-dv/series?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res));
        return (await res.json()) as { series: UsgsSeriesResult[] };
      })
      .then((data) => {
        if (cancelled) return;
        setSeries(data.series ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSeries([]);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey, parameterKey, maxPoints]);

  return { series, loading, error };
}
