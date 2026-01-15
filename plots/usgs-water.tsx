// usgs-water.tsx (DV version, no default statCd)

export type RiverPoint = {
  dateLabel: string; // YYYY-MM-DD
  dateMs: number; // UTC start-of-day
  sort: number; // yyyymmdd
  value: number;
};

export type FetchUsgsDvOpts = {
  site: string; // "07010000"
  parameterCd?: string; // "00065"
  startDT: string; // "YYYY-MM-DD"
  endDT?: string; // optional
  statCd?: string; // optional (DO NOT default)
};

function sortKeyFromYmd(ymd: string): number {
  return Number(ymd.replaceAll("-", ""));
}

function startOfDayUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
}

function toYmd(dateTime: string): string | null {
  if (!dateTime) return null;
  const m1 = dateTime.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m1) return m1[1];
  const m2 = dateTime.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (m2) return m2[1];
  const d = new Date(dateTime);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export async function fetchUsgsRiverDailyDv(
  opts: FetchUsgsDvOpts
): Promise<RiverPoint[] | null> {
  const {
    site,
    parameterCd = "00065",
    startDT,
    endDT,
    statCd, // optional
  } = opts;

  const params = new URLSearchParams({
    service: "dv",
    format: "json",
    sites: site,
    startDT,
    parameterCd,
  });
  if (endDT) params.set("endDT", endDT);
  if (statCd) params.set("statCd", statCd); // ✅ only add if user specifies

  const apiUrl = `/api/usgs?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, { cache: "no-store" });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `USGS proxy status: ${response.status}`);
    }

    const json = await response.json();

    const ts = json?.value?.timeSeries?.[0];
    const values = ts?.values?.[0]?.value ?? [];

    const out: RiverPoint[] = [];
    for (const v of values) {
      const num = Number(v?.value);
      if (!Number.isFinite(num)) continue;

      const ymd = toYmd(String(v?.dateTime ?? ""));
      if (!ymd) continue;

      out.push({
        dateLabel: ymd,
        dateMs: startOfDayUtcMs(ymd),
        sort: sortKeyFromYmd(ymd),
        value: num,
      });
    }

    out.sort((a, b) => a.dateMs - b.dateMs);
    return out;
  } catch (e) {
    console.error("fetchUsgsRiverDailyDv failed:", e);
    return null;
  }
}
