/**
 * Column names and labels for tlpa/wq/usgs_DV_results.parquet.
 *
 * The file is USGS daily values (one row per site, parameter, statistic, and
 * day). Markers use monitoring_location_id plus latitude/longitude. Plots use
 * parameter_code, statistic_id, time, and value.
 */

export const USGS_DATASET = "usgs_DV_results";

export const PARAMETER_NAMES: Record<string, string> = {
  "00060": "Discharge",
  "00065": "Gage height",
  "72019": "Depth to water level",
};

export const STATISTIC_NAMES: Record<string, string> = {
  "00001": "maximum",
  "00002": "minimum",
  "00003": "mean",
  "00008": "median",
  "00012": "equivalent mean",
  "30800": "08:00 reading",
};

export type UsgsParameter = {
  key: string;
  parameter_code: string;
  statistic_id: string;
  unit_of_measure: string;
  label: string;
  count: number;
};

export type UsgsSite = {
  monitoring_location_id: string;
  station_id: number;
  latitude: number;
  longitude: number;
  parameters: UsgsParameter[];
};

export type UsgsSeriesPoint = {
  time: number;
  value: number;
};

export function parameterKey(parameterCode: string, statisticId: string) {
  return `${parameterCode}|${statisticId}`;
}

export function parameterLabel(
  parameterCode: string,
  statisticId: string,
  unit: string,
) {
  const name = PARAMETER_NAMES[parameterCode] ?? `Parameter ${parameterCode}`;
  const statistic = STATISTIC_NAMES[statisticId] ?? `statistic ${statisticId}`;
  const unitText = unit === "ft^3/s" ? "ft³/s" : unit;
  return unitText
    ? `${name}, ${statistic} (${unitText})`
    : `${name}, ${statistic}`;
}

/** USGS site numbers in this file fit in a JS number and are unique. */
export function stationIdFromLocation(monitoringLocationId: string): number {
  return Number(monitoringLocationId.replace(/^USGS-/, ""));
}
