"use client";

import { useEffect, useState } from "react";
import {
  asyncBufferFromUrl,
  cachedAsyncBuffer,
  parquetReadObjects,
} from "hyparquet";

/**
 * Reads Parquet datasets served by the /api/data proxy route.
 *
 * The proxy holds the object store credentials, so nothing here needs them —
 * this is a plain fetch against our own origin. hyparquet reads the footer and
 * then only the column chunks it needs over Range requests, so asking for three
 * columns of a 24-column file does not pull the whole thing.
 */

export type ParquetReadOptions = {
  /** Columns to read. Omit to read all of them. */
  columns?: string[];
  /** First row to read, inclusive. */
  rowStart?: number;
  /** Last row to read, exclusive. */
  rowEnd?: number;
};

/** Map a dataset name to its URL on the proxy route. */
export function parquetUrl(dataset: string): string {
  const name = dataset.replace(/^\/+/, "");
  return `/api/data/${name.endsWith(".parquet") ? name : `${name}.parquet`}`;
}

/**
 * Convert bigints from INT64 columns into plain numbers.
 *
 * Parquet stores integer columns as INT64, which hyparquet faithfully decodes
 * to bigint. React refuses to render a bigint and JSON.stringify throws on one,
 * so a column like dv.parquet's `Number` would break any consumer that just
 * displays what it got. Values beyond Number.MAX_SAFE_INTEGER are left as
 * bigint rather than silently rounded — none of the current datasets have any,
 * and a visible type surprise beats quiet corruption.
 *
 * Shallow by design: these datasets are flat, with no list or struct columns.
 */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  let converted: Record<string, unknown> | undefined;

  for (const key in row) {
    const value = row[key];
    if (
      typeof value === "bigint" &&
      value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      converted ??= { ...row };
      converted[key] = Number(value);
    }
  }

  return converted ?? row;
}

/**
 * In-flight and completed reads, keyed by what was asked for.
 *
 * The overview map renders a popup per site, and each popup mounts plots that
 * read the same dataset — without this, opening the map would fire one read per
 * marker instead of one per distinct request. Published datasets are static for
 * the life of a page view, so caching the promise for the whole session is safe;
 * a reload picks up a republished file (the proxy revalidates against the ETag).
 */
const reads = new Map<string, Promise<unknown[]>>();

function readParquetOnce(
  dataset: string,
  options: ParquetReadOptions
): Promise<unknown[]> {
  const cacheKey = [
    dataset,
    options.columns?.join(",") ?? "*",
    options.rowStart ?? "",
    options.rowEnd ?? "",
  ].join("|");

  const cached = reads.get(cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const file = cachedAsyncBuffer(
      await asyncBufferFromUrl({ url: parquetUrl(dataset) })
    );
    const rows = await parquetReadObjects({
      file,
      columns: options.columns,
      rowStart: options.rowStart,
      rowEnd: options.rowEnd,
    });
    return rows.map(normalizeRow);
  })().catch((err: unknown) => {
    // Don't cache a failure: a transient error should not poison every later
    // read of the dataset for the rest of the session.
    reads.delete(cacheKey);
    throw err;
  });

  reads.set(cacheKey, pending);
  return pending;
}

/**
 * Read a Parquet dataset from the proxy route. Usable outside React.
 *
 * Columns not present in the file are ignored rather than an error, which keeps
 * the `ParamName2 ?? ParamName` style fallbacks working across datasets that
 * carry one column or the other.
 */
export async function readParquet<T>(
  dataset: string,
  options?: ParquetReadOptions
): Promise<T[]> {
  return (await readParquetOnce(dataset, options ?? {})) as T[];
}

/**
 * Generic type T represents the type of one row of data.
 *
 * Returns { rows, loading, error }, and takes a dataset name rather than a path:
 *
 *   useParquetData<Row>("EStL_AllDataJoin2", { columns: ["Name", "Start_Date"] })
 *
 * Naming the columns is worth doing — Parquet is columnar, so a narrow read
 * transfers a fraction of the object.
 *
 * Values are typed by the file, not guessed from text the way papaparse guessed
 * them: date columns arrive as Date objects (at UTC midnight — see lib/date.ts)
 * and integer columns as bigint, which readParquet converts to number.
 */
export function useParquetData<T>(
  dataset: string,
  options?: ParquetReadOptions
) {
  const { columns, rowStart, rowEnd } = options ?? {};
  // Depend on the joined names rather than the array itself, which is usually a
  // fresh literal on every render and would re-fire the effect forever.
  const columnKey = columns?.join(",");

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataset) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    readParquet<T>(dataset, {
      columns: columnKey ? columnKey.split(",") : undefined,
      rowStart,
      rowEnd,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data);
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
  }, [dataset, columnKey, rowStart, rowEnd]);

  return { rows, loading, error };
}