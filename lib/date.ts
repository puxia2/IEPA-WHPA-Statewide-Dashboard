/**
 * Normalize a date value to "MM/DD/YYYY".
 *
 * Parquet carries real types, so a timestamp column arrives as a Date object
 * rather than the "10/1/2020 12:00:00 AM" text the CSVs held. Both are accepted.
 *
 * Date objects are read in UTC on purpose: the publisher writes plain calendar
 * dates, which land as UTC midnight, so local getters would report the previous
 * day for anyone west of Greenwich — every sample in this dataset would shift a
 * day earlier in Illinois.
 */
export function toMDY(dateTime: unknown): string | null {
  if (!dateTime) return null;

  if (dateTime instanceof Date) {
    const ms = dateTime.getTime();
    if (!Number.isFinite(ms)) return null;
    const mm = String(dateTime.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dateTime.getUTCDate()).padStart(2, "0");
    return `${mm}/${dd}/${dateTime.getUTCFullYear()}`;
  }

  const first = String(dateTime).trim().split(/\s+/)[0] || ""; // "10/1/2020"
  // Support both "MM/DD/YYYY" and "YYYY-MM-DD"
  if (first.includes("/")) {
    const [mRaw, dRaw, yRaw] = first.split("/");
    if (!mRaw || !dRaw || !yRaw) return null;
    const mm = mRaw.padStart(2, "0");
    const dd = dRaw.padStart(2, "0");
    const yyyy = yRaw;
    return `${mm}/${dd}/${yyyy}`;
  }

  if (first.includes("-")) {
    const [yRaw, mRaw, dRaw] = first.split("-");
    if (!yRaw || !mRaw || !dRaw) return null;
    const mm = mRaw.padStart(2, "0");
    const dd = dRaw.padStart(2, "0");
    const yyyy = yRaw;
    return `${mm}/${dd}/${yyyy}`;
  }

  return null;
}

export function mdySortKey(mdy: string): number | null {
  // mdy: mm/dd/yyyy
  const [mm, dd, yyyy] = mdy.split("/");
  if (!mm || !dd || !yyyy) return null;
  const key = Number(`${yyyy}${mm}${dd}`);
  return Number.isFinite(key) ? key : null;
}

export function coerceNumber(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
