import {
  MapContainer,
  TileLayer,
  CircleMarker,
  LayersControl,
  useMap,
} from "react-leaflet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import { useCsvData } from "@/components/csv-reader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/styles";
import { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import PopupCard from "./popup-card";
import { RiverLevelPlotRealTime } from "@/plots/river-level-plot-real-time";
import dayjs from "dayjs";
import { TimeSeriesPlotDatestamp } from "@/plots/time-series-plot-datestamp";
import { SearchBySites } from "./search-by-sites";
import IntroMessage from "@/components/intro-message";
import {
  ACTIONS,
  EventData,
  EVENTS,
  Joyride,
  STATUS,
  Step,
} from "react-joyride";

const { BaseLayer } = LayersControl;

function MapAutoResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    // Leaflet does not always detect parent size changes from grid layout;
    // observe container resize and force map size recalculation.
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 50);

    return () => {
      window.clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}

interface MyMapProps {
  position: [number, number];
  zoom: number;
}

interface mapRow {
  Lat: number;
  Long: number;
  Station_ID: number;
  Depth_Qual: string;
  Parameter_Code: number;
  ParamName2?: string;
  ParamName?: string;
  Name: string;
  Organization_Name: string;
  [k: string]: unknown;
}

interface Site {
  name: string;
  station_id: number;
  lat: number;
  lng: number;
  depth_qual: string;
  organization: string;
}

export default function MyMap({ position, zoom }: MyMapProps) {
  const { rows, loading, error } = useCsvData<mapRow>("/EStL_AllDataJoin2.csv");
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  // multiple sites can be selected at once, array of station_id
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [selectedParameterName, setSelectedParameterName] = useState<
    string | null
  >(null);
  const [domain, setDomain] = useState<[number, number] | undefined>(undefined);

  const handleInitialDomain = useCallback((range: [number, number]) => {
    setDomain((prev) => {
      if (!prev) return range;
      if (prev[0] === range[0] && prev[1] === range[1]) return prev;
      return range;
    });
  }, []);

  // Extract unique sites from CSV data
  const sites = useMemo(() => {
    const siteMap = new Map<number, Site>();

    for (const row of rows) {
      const lat = typeof row.Lat === "number" ? row.Lat : Number(row.Lat);
      const lng = typeof row.Long === "number" ? row.Long : Number(row.Long);
      const name = String(row.Name || "").trim();
      const station_id = Number(row.Station_ID || "");
      const organization = String(row.Organization_Name || "").trim();
      const depth_qual =
        String(row.Depth_Qual || "").trim() === "NULL"
          ? "Unknown"
          : String(row.Depth_Qual || "").trim();

      // Skip invalid data
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      // Use station_id as key to ensure uniqueness
      // If same name appears with different coordinates, keep the first one
      if (!siteMap.has(station_id)) {
        siteMap.set(station_id, {
          name,
          station_id,
          lat,
          lng,
          depth_qual,
          organization,
        });
      }
    }

    return Array.from(siteMap.values());
  }, [rows]);

  // extract unique parameter name for each site from CSV data
  const parameterNames = useMemo(() => {
    const parameterNameMap = new Map<number, Set<string>>(); // station_id -> Set<parameterName>
    for (const row of rows) {
      const station_id = Number(row.Station_ID || "");
      const parameterName = String(
        row.ParamName2 || row.ParamName || "",
      ).trim();
      if (!parameterName || !Number.isFinite(station_id)) continue;

      if (!parameterNameMap.has(station_id)) {
        parameterNameMap.set(station_id, new Set());
      }
      parameterNameMap.get(station_id)?.add(parameterName);
    }
    // Convert Set to Array for easier use
    const result = new Map<number, string[]>();
    parameterNameMap.forEach((paramSet, station_id) => {
      result.set(station_id, Array.from(paramSet));
    });
    return result;
  }, [rows]);

  // array of sites that are selected, each site is an object with name, station_id, lat, lng
  const selectedSites = useMemo(
    () => sites.filter((site) => selectedSiteIds.includes(site.station_id)),
    [sites, selectedSiteIds],
  );
  const selectedSiteNames = useMemo(
    () => selectedSites.map((site) => site.name),
    [selectedSites],
  );

  // array of parameter names that are available for allthe selected sites (intersection)
  const availableParameterNames = useMemo(() => {
    if (selectedSites.length === 0) return [];
    const paramArrays = selectedSiteIds.map(
      (station_id) => parameterNames.get(station_id) ?? [],
    );
    if (paramArrays.length === 1) return paramArrays[0];
    const [first, ...rest] = paramArrays;
    return first.filter((param) => rest.every((arr) => arr.includes(param)));
  }, [selectedSiteIds, selectedSites, parameterNames]);

  // const selectedParameterNames = useMemo(
  //   () =>
  //     selectedSiteId !== null ? parameterNames.get(selectedSiteId) : undefined,
  //   [parameterNames, selectedSiteId]
  // );

  // if the selected parameter is still available, keep it (not reset)
  // otherwise, set the first parameter name as the selected parameter name when the site changes
  useEffect(() => {
    if (availableParameterNames.length === 0) {
      setSelectedParameterName(null);
      return;
    }

    setSelectedParameterName((prev) =>
      prev && availableParameterNames.includes(prev)
        ? prev
        : availableParameterNames[0],
    );
  }, [availableParameterNames]);

  // toggle the selection of a site: multi-select sites or cancel selection
  const toggleSiteSelection = (station_id: number) => {
    setSelectedSiteIds(
      (prev) =>
        prev.includes(station_id)
          ? prev.filter((id) => id !== station_id) // remove the site from the selection
          : [...prev, station_id], // add the site to the selection
    );
  };

  // Responsive layout configuration for different screen sizes
  const defaultLayout = {
    lg: [
      { i: "selection", x: 0, y: 0, w: 12, h: 2, static: true },
      { i: "map", x: 0, y: 2, w: 7, h: 17, minW: 4, minH: 10 },
      { i: "timeSeries", x: 7, y: 2, w: 5, h: 9, minW: 4, minH: 7 },
      { i: "riverLevel", x: 7, y: 11, w: 5, h: 8, minW: 4, minH: 6 },
    ],
    md: [
      { i: "selection", x: 0, y: 0, w: 10, h: 2, static: true },
      { i: "map", x: 0, y: 2, w: 10, h: 10, minH: 7 },
      { i: "timeSeries", x: 0, y: 12, w: 10, h: 8, minH: 6 },
      { i: "riverLevel", x: 0, y: 20, w: 10, h: 7, minH: 5 },
    ],
    sm: [
      { i: "selection", x: 0, y: 0, w: 6, h: 2, static: true },
      { i: "map", x: 0, y: 2, w: 6, h: 9, minH: 6 },
      { i: "timeSeries", x: 0, y: 11, w: 6, h: 8, minH: 6 },
      { i: "riverLevel", x: 0, y: 19, w: 6, h: 7, minH: 5 },
    ],
    xs: [
      { i: "selection", x: 0, y: 0, w: 4, h: 3, static: true },
      { i: "map", x: 0, y: 3, w: 4, h: 8, minH: 6 },
      { i: "timeSeries", x: 0, y: 11, w: 4, h: 8, minH: 6 },
      { i: "riverLevel", x: 0, y: 19, w: 4, h: 7, minH: 5 },
    ],
    xxs: [
      { i: "selection", x: 0, y: 0, w: 2, h: 3, static: true },
      { i: "map", x: 0, y: 3, w: 2, h: 8, minH: 6 },
      { i: "timeSeries", x: 0, y: 11, w: 2, h: 8, minH: 6 },
      { i: "riverLevel", x: 0, y: 19, w: 2, h: 7, minH: 5 },
    ],
  };

  const [layouts, setLayouts] = useState(defaultLayout);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onLayoutsChange = (_currentLayout: any, allLayouts: any) => {
    setLayouts(allLayouts);
  };

  const [gridWidth, setGridWidth] = useState(1200);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateWidth = () => {
      const containerWidth = gridContainerRef.current?.clientWidth;
      if (containerWidth && containerWidth > 0) {
        setGridWidth(containerWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (gridContainerRef.current) {
      resizeObserver.observe(gridContainerRef.current);
    }
    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  const chartHeights = useMemo(() => {
    if (currentBreakpoint === "xxs" || currentBreakpoint === "xs") {
      return { timeSeries: 230, riverLevel: 220 };
    }
    if (currentBreakpoint === "sm") {
      return { timeSeries: 250, riverLevel: 240 };
    }
    if (currentBreakpoint === "md") {
      return { timeSeries: 290, riverLevel: 270 };
    }
    return { timeSeries: 320, riverLevel: 290 };
  }, [currentBreakpoint]);

  const tourSteps: Step[] = useMemo(
    () => [
      {
        target: ".quick-select-panel",
        content: (
          <div>
            <p>
              This panel allows you to filter sites based on shared attributes.
              Click on a button to quickly select and view sites&apos; data.
              When selected, the time series chart will populate and the map
              will be updated based on your selection.
            </p>
            <p>
              For this tour, we&apos;ll automatically select all deep IDOT wells
              — <strong>Select all IDOT Sites (D)</strong> — and chlorobenzene
              as the parameter.
            </p>
          </div>
        ),
        placement: "bottom",
      },
      {
        target: ".multi-selection-panel",
        content: (
          <div>
            <p>
              If you want to select sites that are not grouped in the quick
              selections above, use this dropdown to choose one or more sites
              when you do not know their precise location on the map.
            </p>
            <p>
              Once a site (or sites) is selected, the time series chart will
              populate and the map will update based on your selection.
            </p>
            <p>
              For this tour, we have selected:{" "}
              <strong>PM1D, PM2D, PM3D, PM4D, PM5D, and PM6D</strong> (IDNR-16).
            </p>
          </div>
        ),
        placement: "bottom",
      },
      {
        target: ".tour-map-panel",
        content: (
          <div>
            <p>
              Scroll, zoom, and click to learn more about the region and
              sampling sites.
            </p>
            <p>
              Click one or more sites on the map to quickly view time series
              data for that selection.
            </p>
          </div>
        ),
        placement: "bottom",
      },
      {
        target: ".tour-map-panel .react-resizable-handle-se",
        content: (
          <div>
            <p>
              To view the map or time-series panels at a different size, click
              and drag gray corners like this one to resize the panel.
            </p>
          </div>
        ),
        placement: "bottom",
      },
      {
        target: ".tour-move-handle",
        content: (
          <div>
            <p>
              To reorganize the panel layout, click and drag the gray bar at the
              top of each panel to move it to a new location.
            </p>
          </div>
        ),
        placement: "left",
      },
      {
        target: ".tour-time-series-panel",
        content: (
          <div>
            <p>
              This time series graph shows how water quality concentrations
              change over time for the site(s) selected on the map.
            </p>
            <p>
              Choose a constituent/parameter from the dropdown in the upper
              right corner of the panel. Unless otherwise noted, concentrations
              are shown in <strong>parts per billion (ppb)</strong>.
            </p>
          </div>
        ),
        placement: "left",
      },
      {
        target: ".tour-parameter-dropdown",
        content: (
          <div>
            <p>
              For the selected sites, use this dropdown menu to select a shared
              water quality parameter to examine each site&apos;s sampling time
              series for this constituent.
            </p>
          </div>
        ),
        placement: "left",
      },
      {
        target: ".tour-river-level-panel",
        content: (
          <div>
            <p>
              This panel shows Mississippi River gage height (ft) from the{" "}
              <strong>USGS-07010000</strong> gaging station (Mississippi River
              at St. Louis, MO).
            </p>
            <p>
              The time series shifts to match the date range available for the
              selected sites and parameters.
            </p>
            <p>
              Use the slider beneath the plot to adjust the displayed date
              range.
            </p>
          </div>
        ),
        placement: "left",
      },
    ],
    [],
  );

  const selectAllIDOTSitesD = useCallback(() => {
    setSelectedSiteIds([56, 58, 60, 96, 556, 559]);
    setSelectedParameterName("Chlorobenzene");
  }, [setSelectedSiteIds, setSelectedParameterName]);

  const selectAllIDOTSitesM = useCallback(() => {
    setSelectedSiteIds([57, 59, 61, 97, 557, 560]);
    setSelectedParameterName("Chlorobenzene");
  }, [setSelectedSiteIds, setSelectedParameterName]);

  const selectAllIDOTSitesS = useCallback(() => {
    setSelectedSiteIds([558, 561]);
    setSelectedParameterName("Chlorobenzene");
  }, [setSelectedSiteIds, setSelectedParameterName]);

  const handleJoyrideEvent = useCallback(
    (data: EventData) => {
      const { action, index, status, type } = data;

      if (type === EVENTS.STEP_BEFORE && index === 0) {
        selectAllIDOTSitesD();
      }

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRunTour(false);
        setTourStepIndex(0);
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        setTourStepIndex(nextIndex);
      }
    },
    [selectAllIDOTSitesD],
  );

  return (
    <div className="w-full min-h-screen p-1">
      <Joyride
        run={runTour}
        steps={tourSteps}
        stepIndex={tourStepIndex}
        continuous
        scrollToFirstStep
        onEvent={handleJoyrideEvent}
        locale={{
          back: "Previous",
          close: "Close",
          last: "Last",
          next: "Next",
          skip: "Skip",
        }}
        options={{
          zIndex: 9999,
          buttons: ["back", "close", "primary", "skip"],
          showProgress: true,
          skipScroll: true,
          skipBeacon: true,
        }}
      />
      <IntroMessage />
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setLayouts(defaultLayout)}>
          Default Layout
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setTourStepIndex(0);
            setRunTour(true);
          }}
          className="bg-amber-600 text-white"
        >
          Start Tour
        </Button>
      </div>
      {/* Grid Layout Container */}
      <div ref={gridContainerRef} className="w-full">
        <Responsive
          className="layout"
          layouts={layouts}
          onLayoutChange={onLayoutsChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          onBreakpointChange={(newBreakpoint) =>
            setCurrentBreakpoint(newBreakpoint)
          }
          rowHeight={50}
          margin={[8, 8]}
          containerPadding={[0, 0]}
          width={gridWidth}
          dragConfig={{
            enabled: true,
            handle: ".panel-drag-handle",
            cancel: ".panel-no-drag",
          }}
          resizeConfig={{ enabled: true }}
        >
          <div
            key="selection"
            className="panel mb-4 bg-white rounded-lg shadow-sm border overflow-hidden"
          >
            {/* Quick select buttons */}
            <div className="px-2 py-1 text-xs font-semibold border-b flex justify-center gap-4 quick-select-panel">
              <Button
                variant="outline"
                className="tour-select-idot-btn"
                onClick={() => {
                  selectAllIDOTSitesD();
                }}
              >
                Select all IDOT Sites (D)
              </Button>

              <Button
                variant="outline"
                className="tour-select-idot-btn"
                onClick={() => {
                  selectAllIDOTSitesM();
                }}
              >
                Select all IDOT Sites (M)
              </Button>

              <Button
                variant="outline"
                className="tour-select-idot-btn"
                onClick={() => {
                  selectAllIDOTSitesS();
                }}
              >
                Select all IDOT Sites (S)
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSiteIds([85, 86, 87, 93, 94, 95]);
                  setSelectedParameterName("Chlorobenzene");
                }}
              >
                Select all GWE Sites
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSiteIds([82, 83, 84, 549, 550, 551, 552]);
                  setSelectedParameterName("Chlorobenzene");
                }}
              >
                Select all ESL Sites
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSiteIds([
                    68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 261,
                  ]);
                  setSelectedParameterName("Chlorobenzene");
                }}
              >
                Select all BWMW Sites
              </Button>
            </div>

            {/* Search by sites */}
            <div className="p-2 panel-no-drag multi-selection-panel">
              <SearchBySites
                sites={sites}
                selectedSiteIds={selectedSiteIds}
                onSelectedSiteIdsChange={setSelectedSiteIds}
              />
            </div>
          </div>

          {/* Map Component */}
          <div
            key="map"
            className="panel tour-map-panel bg-white rounded-lg shadow-sm border overflow-hidden relative flex flex-col"
            style={{ position: "relative" }}
          >
            <div className="panel-drag-handle cursor-move bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 border-b tour-move-handle">
              Map
            </div>
            <div
              className="flex-1 w-full panel-no-drag"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <MapContainer
                center={position}
                zoom={zoom}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
              >
                <MapAutoResize />
                <LayersControl position="topright">
                  <BaseLayer checked name="Streets">
                    {/* street map */}
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

                {loading && (
                  <div className="absolute top-4 left-4 z-[1000] bg-white p-2 rounded shadow">
                    Loading sites...
                  </div>
                )}
                {error && (
                  <div className="absolute top-4 left-4 z-[1000] bg-red-100 text-red-800 p-2 rounded shadow">
                    Error: {error}
                  </div>
                )}

                <MarkerClusterGroup>
                  {sites.map((site, index) => {
                    const isSelected = selectedSiteIds.includes(
                      site.station_id,
                    );
                    return (
                      <CircleMarker
                        key={`${site.name}-${index}`}
                        center={[site.lat, site.lng]}
                        radius={isSelected ? 15 : 12}
                        // use pathOptions to set the color and fill color of the circle
                        // not working with color and fillColor props
                        pathOptions={{
                          color: isSelected ? "blue" : "black", // border color
                          fillColor: isSelected ? "blue" : "red", // fill color
                          fillOpacity: isSelected ? 0.6 : 0.5,
                        }}
                        eventHandlers={{
                          click: () => {
                            toggleSiteSelection(site.station_id);
                          },
                          mouseover: (e) => e.target.openPopup(),
                        }}
                      >
                        <PopupCard site={site} isSelected={isSelected} />
                      </CircleMarker>
                    );
                  })}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          </div>

          {/* Time Series Plot Component */}
          <div
            key="timeSeries"
            className="panel tour-time-series-panel bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col"
          >
            <div className="panel-drag-handle cursor-move bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 border-b">
              Time Series Plot
            </div>

            {/* Control panel - fixed at top of the time series plot component */}
            <div className="mt-2 flex justify-end gap-2 px-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSiteIds([]);
                  setSelectedParameterName(null);
                }}
              >
                Reset
              </Button>

              <Select
                value={selectedParameterName ?? ""}
                onValueChange={(value) =>
                  setSelectedParameterName(value ?? null)
                }
              >
                <SelectTrigger className="w-[180px] tour-parameter-dropdown">
                  <SelectValue placeholder="Select a parameter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Parameters</SelectLabel>
                    {availableParameterNames?.map((param) => (
                      <SelectItem key={param} value={param}>
                        {param}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div
              className="panel-no-drag flex-1 min-h-0 w-full overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <TimeSeriesPlotDatestamp
                targetParam={selectedParameterName ?? ""}
                sites={selectedSiteNames}
                xDomain={domain}
                onInitialDomain={handleInitialDomain}
                height={chartHeights.timeSeries}
              />
            </div>
          </div>

          {/* River Level Plot Component */}
          <div
            key="riverLevel"
            className="panel tour-river-level-panel bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col"
          >
            <div className="panel-drag-handle cursor-move bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 border-b">
              River Level Plot
            </div>
            <div
              className="panel-no-drag flex-1 min-h-0 w-full overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <RiverLevelPlotRealTime
                csvPath="/dv.csv"
                site="07010000"
                startDT="2000-01-02"
                parameterCd="00065"
                xDomain={domain}
                onDomainChange={setDomain}
                refreshMs={5 * 60 * 1000}
                statCd="00003"
                height={chartHeights.riverLevel}
              />
              {domain && (
                <div className="px-4 pb-2 flex justify-between text-sm text-muted-foreground">
                  <span>Start: {dayjs(domain[0]).format("YYYY-MM-DD")}</span>
                  <span>End: {dayjs(domain[1]).format("YYYY-MM-DD")}</span>
                </div>
              )}
            </div>
          </div>
        </Responsive>
      </div>
    </div>
  );
}
