import "server-only";

import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { parquetMetadataAsync, parquetReadObjects } from "hyparquet";

import { getS3Client, S3_BUCKET, S3_PREFIX } from "@/lib/s3";
import {
  parameterKey,
  parameterLabel,
  stationIdFromLocation,
  USGS_DATASET,
  type UsgsParameter,
  type UsgsSite,
} from "@/lib/usgs-dv";

const COLUMNS = [
  "monitoring_location_id",
  "parameter_code",
  "statistic_id",
  "time",
  "value",
  "unit_of_measure",
  "latitude",
  "longitude",
];

const DATASET_KEY = `${S3_PREFIX}/${USGS_DATASET}.parquet`;

type RawRow = {
  monitoring_location_id?: string;
  parameter_code?: string;
  statistic_id?: string;
  time?: unknown;
  value?: unknown;
  unit_of_measure?: string;
  latitude?: unknown;
  longitude?: unknown;
};

export type UsgsSeriesData = {
  monitoring_location_id: string;
  parameter_code: string;
  statistic_id: string;
  unit_of_measure: string;
  label: string;
  times: number[];
  values: number[];
};

type Index = {
  sites: UsgsSite[];
  series: Map<string, UsgsSeriesData>;
};

function toEpochMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

async function openParquet() {
  const client = getS3Client();
  const head = await client.send(
    new HeadObjectCommand({ Bucket: S3_BUCKET, Key: DATASET_KEY }),
  );
  const byteLength = head.ContentLength;
  if (!byteLength) {
    throw new Error(`Empty object s3://${S3_BUCKET}/${DATASET_KEY}`);
  }

  return {
    byteLength,
    async slice(start: number, end?: number) {
      const stop = (end ?? byteLength) - 1;
      const result = await client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: DATASET_KEY,
          Range: `bytes=${start}-${stop}`,
        }),
      );
      if (!result.Body) throw new Error("Empty S3 range response");
      const bytes = await result.Body.transformToByteArray();
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    },
  };
}

function collapseDaily(times: number[], values: number[]) {
  const order = times.map((_, index) => index);
  order.sort((a, b) => times[a] - times[b]);

  const outTimes: number[] = [];
  const outValues: number[] = [];
  let currentTime = Number.NaN;
  let sum = 0;
  let count = 0;

  const flush = () => {
    if (!count) return;
    outTimes.push(currentTime);
    outValues.push(sum / count);
  };

  for (const index of order) {
    const time = times[index];
    if (time !== currentTime) {
      flush();
      currentTime = time;
      sum = 0;
      count = 0;
    }
    sum += values[index];
    count += 1;
  }
  flush();
  return { times: outTimes, values: outValues };
}

async function buildIndex(): Promise<Index> {
  const file = await openParquet();
  const metadata = await parquetMetadataAsync(file);
  const built = new Map<
    string,
    {
      monitoring_location_id: string;
      parameter_code: string;
      statistic_id: string;
      unit_of_measure: string;
      latitude: number;
      longitude: number;
      times: number[];
      values: number[];
    }
  >();

  let rowStart = 0;
  const groups = metadata.row_groups;
  for (let i = 0; i < groups.length; i++) {
    const rowEnd = rowStart + Number(groups[i].num_rows);
    console.log(
      `[usgs-dv] reading s3://${S3_BUCKET}/${DATASET_KEY} row group ${i + 1}/${groups.length}`,
    );
    const rows = (await parquetReadObjects({
      file,
      metadata,
      columns: COLUMNS,
      rowStart,
      rowEnd,
    })) as RawRow[];

    for (const row of rows) {
      const id = String(row.monitoring_location_id ?? "").trim();
      const code = String(row.parameter_code ?? "").trim();
      const stat = String(row.statistic_id ?? "").trim();
      const lat =
        typeof row.latitude === "number" ? row.latitude : Number(row.latitude);
      const lon =
        typeof row.longitude === "number"
          ? row.longitude
          : Number(row.longitude);
      const value =
        typeof row.value === "number" ? row.value : Number(row.value);
      const time = toEpochMs(row.time);
      if (!id || !code || !stat || time === null) continue;
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        !Number.isFinite(value)
      ) {
        continue;
      }

      const key = `${id}|${parameterKey(code, stat)}`;
      let series = built.get(key);
      if (!series) {
        series = {
          monitoring_location_id: id,
          parameter_code: code,
          statistic_id: stat,
          unit_of_measure: String(row.unit_of_measure ?? "").trim(),
          latitude: lat,
          longitude: lon,
          times: [],
          values: [],
        };
        built.set(key, series);
      }
      series.times.push(time);
      series.values.push(value);
    }

    rowStart = rowEnd;
  }

  const bySite = new Map<string, UsgsSite>();
  const series = new Map<string, UsgsSeriesData>();

  for (const raw of built.values()) {
    const daily = collapseDaily(raw.times, raw.values);
    const label = parameterLabel(
      raw.parameter_code,
      raw.statistic_id,
      raw.unit_of_measure,
    );
    const param: UsgsParameter = {
      key: parameterKey(raw.parameter_code, raw.statistic_id),
      parameter_code: raw.parameter_code,
      statistic_id: raw.statistic_id,
      unit_of_measure: raw.unit_of_measure,
      label,
      count: daily.values.length,
    };
    series.set(`${raw.monitoring_location_id}|${param.key}`, {
      monitoring_location_id: raw.monitoring_location_id,
      parameter_code: raw.parameter_code,
      statistic_id: raw.statistic_id,
      unit_of_measure: raw.unit_of_measure,
      label,
      times: daily.times,
      values: daily.values,
    });

    let site = bySite.get(raw.monitoring_location_id);
    if (!site) {
      site = {
        monitoring_location_id: raw.monitoring_location_id,
        station_id: stationIdFromLocation(raw.monitoring_location_id),
        latitude: raw.latitude,
        longitude: raw.longitude,
        parameters: [],
      };
      bySite.set(raw.monitoring_location_id, site);
    }
    site.parameters.push(param);
  }

  const sites = Array.from(bySite.values()).sort((a, b) =>
    a.monitoring_location_id.localeCompare(b.monitoring_location_id),
  );
  for (const site of sites) {
    site.parameters.sort((a, b) => a.label.localeCompare(b.label));
  }

  console.log(
    `[usgs-dv] indexed ${sites.length} sites and ${series.size} series from ${USGS_DATASET}`,
  );
  return { sites, series };
}

let indexPromise: Promise<Index> | undefined;

export function getUsgsIndex(): Promise<Index> {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((err: unknown) => {
      indexPromise = undefined;
      throw err;
    });
  }
  return indexPromise;
}

export async function queryUsgsSeries(opts: {
  siteIds: string[];
  parameterKeys: string[];
}) {
  const index = await getUsgsIndex();
  const siteSet = new Set(opts.siteIds);
  const keySet = new Set(opts.parameterKeys);
  const matches: UsgsSeriesData[] = [];
  for (const series of index.series.values()) {
    if (!siteSet.has(series.monitoring_location_id)) continue;
    const key = parameterKey(series.parameter_code, series.statistic_id);
    if (keySet.size > 0 && !keySet.has(key)) continue;
    matches.push(series);
  }
  return matches;
}
