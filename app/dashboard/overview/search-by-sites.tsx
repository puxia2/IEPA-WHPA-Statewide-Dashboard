"use client";

import { MultiSelect } from "@/components/multi-select";
import { useMemo } from "react";

interface Site {
  name: string;
  station_id: number;
  organization: string;
  lat: number;
  lng: number;
  depth_qual: string;
}

interface SearchBySitesProps {
  sites: Site[];
  selectedSiteIds: number[];
  onSelectedSiteIdsChange: (ids: number[]) => void;
}

export function SearchBySites({
  sites, // array of unique sites, sites =[{name: string, station_id: number, lat: number, lng: number, depth_qual: string, organization: string}]
  selectedSiteIds,
  onSelectedSiteIdsChange,
}: SearchBySitesProps) {
  const options = useMemo(
    () =>
      sites.map((site) => ({
        label: `${site.name}`,
        value: String(site.station_id),
      })),
    [sites],
  );

  return (
    <div className="w-full">
      <MultiSelect
        options={options}
        onValueChange={(values) => {
          const ids = values
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v));
          onSelectedSiteIdsChange(ids);
        }}
        defaultValue={selectedSiteIds.map(String)}
        placeholder="Search and select site(s)"
        modalPopover={true}
        popoverClassName="z-[10000]"
        searchable={true}
        maxCount={4}
      />
    </div>
  );
}
