"use client";

import { useMemo, useState } from "react";
import {
  GeoJSON,
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  Rectangle,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { Feature, MultiPolygon } from "geojson";
import { contours } from "d3-contour";
import { interpolateBlues, interpolateYlOrBr, interpolateViridis } from "d3";
import { scaleSequential } from "d3-scale";
import { useCsvData } from "@/components/csv-reader";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const { BaseLayer } = LayersControl;

interface CsvRow {
  Station_ID: number;
  Name: string;
  Lat: number;
  Long: number;
  ParamName2: string;
  yr: number;
  avg_result_value_ugL: number;
  cnt?: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// this function is used to calculate the quantile of a sorted array
const quantileSorted = (sorted: number[], q: number) => {
  if (sorted.length === 0) return NaN;
  const qq = Math.min(1, Math.max(0, q));
  const idx = (sorted.length - 1) * qq;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
};

// if x is between lo and hi, return x, otherwise return the closer bound
const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

export default function ContourMap() {
  const { rows, loading, error } = useCsvData<CsvRow>(
    "/EStL_AllDataJoin_year.csv",
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const row of rows) {
      if (isFiniteNumber(row.yr)) set.add(row.yr);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const [selectedYear, setSelectedYear] = useState<string>("");
  const activeYear =
    selectedYear && Number.isFinite(Number(selectedYear))
      ? Number(selectedYear)
      : (years[0] ?? NaN);

  const parameterNames = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (!Number.isFinite(activeYear) || row.yr !== activeYear) continue;
      const param = String(row.ParamName2 ?? "").trim();
      if (param) set.add(param);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, activeYear]);

  const [selectedParam, setSelectedParam] = useState<string>("");
  const [scaleMode, setScaleMode] = useState<"linear" | "log">("log");
  const [colorbarType, setColorbarType] = useState<
    "blues" | "ylOrBr" | "viridis"
  >("blues");

  const colorScaleFunction = useMemo(() => {
    switch (colorbarType) {
      case "blues":
        return interpolateBlues;
      case "ylOrBr":
        return interpolateYlOrBr;
      case "viridis":
        return interpolateViridis;
    }
  }, [colorbarType]);

  const activeParam =
    selectedParam && parameterNames.includes(selectedParam)
      ? selectedParam
      : (parameterNames[0] ?? "");

  const filteredPoints = useMemo(() => {
    if (!activeParam || !Number.isFinite(activeYear)) return [];

    return rows
      .filter((row) => {
        if (row.yr !== activeYear) return false;
        if (String(row.ParamName2 ?? "").trim() !== activeParam) return false;
        return (
          isFiniteNumber(row.Station_ID) &&
          isFiniteNumber(row.Lat) &&
          isFiniteNumber(row.Long) &&
          isFiniteNumber(row.avg_result_value_ugL)
        );
      })
      .map((row) => ({
        stationId: row.Station_ID,
        name: String(row.Name ?? `Station ${row.Station_ID}`),
        lat: row.Lat,
        lng: row.Long,
        value: row.avg_result_value_ugL,
        cnt: isFiniteNumber(row.cnt) ? row.cnt : undefined,
      }));
  }, [rows, activeParam, activeYear]);

  const center = useMemo<[number, number]>(() => {
    if (filteredPoints.length === 0) return [38.65, -90.2];
    const latAvg =
      filteredPoints.reduce((acc, p) => acc + p.lat, 0) / filteredPoints.length;
    const lngAvg =
      filteredPoints.reduce((acc, p) => acc + p.lng, 0) / filteredPoints.length;
    return [latAvg, lngAvg];
  }, [filteredPoints]);

  const valueTransform = useMemo(() => {
    const vals = filteredPoints
      .map((p) => p.value)
      .filter((v) => Number.isFinite(v));
    const rawMin = vals.length > 0 ? Math.min(...vals) : 0;
    const shift = scaleMode === "log" && rawMin <= 0 ? 1 - rawMin : 0;
    const toTransformed = (v: number) =>
      scaleMode === "log" ? Math.log10(Math.max(v + shift, 1e-12)) : v;
    const toRaw = (tv: number) =>
      scaleMode === "log" ? Math.pow(10, tv) - shift : tv;
    return { shift, toTransformed, toRaw };
  }, [filteredPoints, scaleMode]);

  const transformedPoints = useMemo(
    () =>
      filteredPoints.map((p) => ({
        ...p,
        tValue: valueTransform.toTransformed(p.value),
      })),
    [filteredPoints, valueTransform],
  );

  const robustRange = useMemo<[number, number]>(() => {
    if (transformedPoints.length === 0) return [0, 1];
    const sorted = transformedPoints
      .map((p) => p.tValue)
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    if (sorted.length === 0) return [0, 1];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (max <= min) return [min, max + 1];
    const p05 = quantileSorted(sorted, 0.05);
    const p95 = quantileSorted(sorted, 0.95);
    if (!Number.isFinite(p05) || !Number.isFinite(p95) || p95 <= p05) {
      return [min, max];
    }
    return [p05, p95];
  }, [transformedPoints]);

  const contourFeatures = useMemo(() => {
    if (transformedPoints.length < 4) return [] as Feature<MultiPolygon>[];

    const lats = transformedPoints.map((p) => p.lat);
    const lngs = transformedPoints.map((p) => p.lng);
    const values = transformedPoints.map((p) => p.tValue);

    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs);
    const lngMax = Math.max(...lngs);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const [valueMin, valueMax] = robustRange;

    if (
      !Number.isFinite(rawMin) ||
      !Number.isFinite(rawMax) ||
      rawMax <= rawMin ||
      !Number.isFinite(valueMin) ||
      !Number.isFinite(valueMax)
    ) {
      return [] as Feature<MultiPolygon>[];
    }

    const nx = 80;
    const ny = 80;
    const dx = (lngMax - lngMin) / (nx - 1 || 1);
    const dy = (latMax - latMin) / (ny - 1 || 1);

    const grid: number[] = [];
    const kNearest = 8;
    for (let j = 0; j < ny; j++) {
      const lat = latMin + j * dy;
      for (let i = 0; i < nx; i++) {
        const lng = lngMin + i * dx;

        // Local IDW interpolation on a regular grid (k nearest points only).
        const distances: Array<{ distSq: number; value: number }> = [];
        for (const p of transformedPoints) {
          const dLat = lat - p.lat;
          const dLng = lng - p.lng;
          const distSq = dLat * dLat + dLng * dLng;
          distances.push({
            distSq,
            value: clamp(p.tValue, valueMin, valueMax),
          });
        }

        distances.sort((a, b) => a.distSq - b.distSq);
        const nearest = distances.slice(
          0,
          Math.min(kNearest, distances.length),
        );

        let weighted = 0;
        let weights = 0;
        for (const n of nearest) {
          if (n.distSq < 1e-12) {
            weighted = n.value;
            weights = 1;
            break;
          }
          // distSq^1 == d^2, equivalent to classic IDW p=2
          const w = 1 / Math.pow(n.distSq, 1);
          weighted += n.value * w;
          weights += w;
        }
        grid.push(weights > 0 ? weighted / weights : valueMin);
      }
    }

    // Preserve station values by snapping each station to its nearest grid cell.
    for (const p of transformedPoints) {
      const i = Math.max(
        0,
        Math.min(nx - 1, Math.round((p.lng - lngMin) / (dx || 1))),
      );
      const j = Math.max(
        0,
        Math.min(ny - 1, Math.round((p.lat - latMin) / (dy || 1))),
      );
      grid[j * nx + i] = clamp(p.tValue, valueMin, valueMax);
    }

    const levelCount = 12;
    const step = (valueMax - valueMin) / levelCount;
    const thresholds = Array.from(
      { length: levelCount - 1 },
      (_, idx) => valueMin + step * (idx + 1),
    );

    return contours()
      .size([nx, ny])
      .thresholds(thresholds)(grid)
      .map((c): Feature<MultiPolygon> => {
        const multipolygon = c.coordinates.map((polygon) =>
          polygon.map((ring) =>
            ring.map(([x, y]) => [
              lngMin + (x / (nx - 1)) * (lngMax - lngMin),
              latMin + (y / (ny - 1)) * (latMax - latMin),
            ]),
          ),
        );

        return {
          type: "Feature",
          properties: { value: c.value },
          geometry: {
            type: "MultiPolygon",
            coordinates: multipolygon,
          },
        };
      });
  }, [transformedPoints, robustRange]);

  const contourBounds = useMemo<
    [[number, number], [number, number]] | null
  >(() => {
    if (filteredPoints.length < 2) return null;
    const lats = filteredPoints.map((p) => p.lat);
    const lngs = filteredPoints.map((p) => p.lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }, [filteredPoints]);

  const valueRange = robustRange;
  const isFlatField = useMemo(() => {
    if (transformedPoints.length === 0) return false;
    const vals = transformedPoints.map((p) => p.tValue).filter(Number.isFinite);
    if (vals.length === 0) return false;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return Math.abs(max - min) < 1e-9;
  }, [transformedPoints]);

  const colorScale = useMemo(
    () => scaleSequential(colorScaleFunction).domain(valueRange),
    [valueRange, colorScaleFunction],
  );

  const [minValue, maxValue] = valueRange;
  const minValueRaw = valueTransform.toRaw(minValue);
  const maxValueRaw = valueTransform.toRaw(maxValue);
  const colorbarStops = useMemo(
    () =>
      [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        offset: `${t * 100}%`,
        color: colorScale(minValue + t * (maxValue - minValue)),
      })),
    [colorScale, minValue, maxValue],
  );

  return (
    <div className="w-full h-[calc(100vh-110px)] min-h-[600px]">
      <div className="h-full flex flex-col lg:flex-row gap-3">
        <div className="min-h-[420px] rounded-lg overflow-hidden border w-full lg:w-[calc(100%-380px)]">
          <MapContainer
            center={center}
            zoom={11}
            scrollWheelZoom
            style={{ width: "100%", height: "100%" }}
          >
            <LayersControl position="topright">
              <BaseLayer checked name="Streets">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </BaseLayer>
              <BaseLayer name="Satellite (Esri)">
                <TileLayer
                  attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </BaseLayer>
            </LayersControl>

            {/* Fill the full interpolation extent with the minimum color so low values are also visible. */}
            {contourBounds && (
              <Rectangle
                key={`base-${activeYear}-${activeParam}-${scaleMode}`}
                bounds={contourBounds}
                pathOptions={{
                  color: "transparent",
                  weight: 0,
                  fillOpacity: 0.42,
                  fillColor: colorScale(minValue),
                }}
              />
            )}

            {contourFeatures.map((feature, idx) => (
              <GeoJSON
                key={`${activeYear}-${activeParam}-${scaleMode}-${idx}`}
                data={feature}
                style={() => ({
                  color: "transparent",
                  weight: 0,
                  fillOpacity: 0.42,
                  fillColor: colorScale(
                    Number(feature.properties?.value ?? valueRange[0]),
                  ),
                })}
              />
            ))}

            {filteredPoints.map((p) => (
              <Marker key={p.stationId} position={[p.lat, p.lng]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-medium">{p.name}</div>
                    <div>Station ID: {p.stationId}</div>
                    <div>
                      {activeParam}: {p.value.toFixed(2)} ug/L
                    </div>
                    {p.cnt !== undefined && <div>Sample count: {p.cnt}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}

            {isFlatField && (
              <div className="absolute left-3 top-3 z-[1000] rounded border bg-white/90 px-2 py-1 text-xs text-muted-foreground shadow">
                The site values of current Year + Param are almost the same, so
                no contour can be formed.
              </div>
            )}
          </MapContainer>
        </div>

        <div className="w-full lg:w-[360px] shrink-0 rounded-lg border bg-white shadow p-3 h-fit">
          <div className="text-sm font-semibold mb-2">Year</div>
          <Select
            value={String(activeYear || "")}
            onValueChange={setSelectedYear}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              <SelectGroup>
                <SelectLabel>Year</SelectLabel>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="text-sm font-semibold mt-3 mb-2">
            Contour Parameter
          </div>
          <Select value={activeParam} onValueChange={setSelectedParam}>
            <SelectTrigger>
              <SelectValue placeholder="Select ParamName" />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              <SelectGroup>
                <SelectLabel>ParamName</SelectLabel>
                {parameterNames.map((param) => (
                  <SelectItem key={param} value={param}>
                    {param}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="text-sm font-semibold mt-3 mb-2">Scale</div>
          <Select
            value={scaleMode}
            onValueChange={(value) => setScaleMode(value as "log" | "linear")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select scale" />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              <SelectGroup>
                <SelectLabel>Scale</SelectLabel>
                <SelectItem value="log">Log</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-2">
            Values are yearly averages for Year=
            {Number.isFinite(activeYear) ? activeYear : "-"}.
          </div>

          <div className="text-sm font-semibold mb-2 mt-3">Colorbar Type</div>
          <Select value={colorbarType} onValueChange={setColorbarType}>
            <SelectTrigger>
              <SelectValue placeholder="Select Colorbar Type" />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              <SelectGroup>
                <SelectLabel>Colorbar Type</SelectLabel>

                <SelectItem value="blues">Blues</SelectItem>
                <SelectItem value="ylOrBr">YlOrBr</SelectItem>
                <SelectItem value="viridis">Viridis</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Colorbar</div>
            <div
              className="h-4 w-full rounded border"
              style={{
                background: `linear-gradient(to right, ${colorbarStops
                  .map((s) => `${s.color} ${s.offset}`)
                  .join(", ")})`,
              }}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{minValueRaw.toFixed(2)} ug/L</span>
              <span>{maxValueRaw.toFixed(2)} ug/L</span>
            </div>
          </div>
          {loading && <div className="text-xs mt-2">Loading CSV...</div>}
          {error && (
            <div className="text-xs mt-2 text-red-600">Error: {error}</div>
          )}

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
            <p>
              The contours presented here are raw interpolations from data
              reported/recorded in the Illinois State Water Survey (ISWS) water
              quality database. This tool is meant to help researchers explore
              available groundwater quality data, learn where data gaps are
              present, and gain a greater understanding of the breadth and depth
              of data recorded in the ISWS database.
            </p>
            <p className="mt-2">
              <span className="font-semibold">Disclaimer:</span> These plots are
              NOT meant for policy- or management-related decisions. They are
              formulated from the raw data of the dashboard without QA/QC
              procedures.
            </p>
            <p className="mt-2">
              The contour data presented in the associated map was interpolated
              using the Inverse Distance Weighting method. This method is
              described{" "}
              <a
                href="https://en.wikipedia.org/wiki/Inverse_distance_weighting"
                target="_blank"
                rel="noreferrer"
                className="underline text-amber-900 hover:text-amber-700"
              >
                here
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
