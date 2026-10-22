"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/multi-select";
import { useState, useMemo } from "react";
import { useParquetData } from "@/components/parquet-reader";
import BoxPlotSingleSite from "@/plots/box-plot-single-site";

interface DataRow {
  ParamName2?: string;
  ParamName?: string;
  Name: string;
  [k: string]: unknown; // there could be more columns, type is unknown
}

const DATASET = "EStL_AllDataJoin2";

// The dropdown only lists parameter names per site, so three columns are enough.
const COLUMNS = ["Name", "ParamName2", "ParamName"];

interface Site {
  name: string;
  station_id: number;
  organization: string;
  lat: number;
  lng: number;
  depth_qual: string;
}

export function DialogCard({ siteName }: { siteName: Site }) {
  const { rows, loading, error } = useParquetData<DataRow>(DATASET, {
    columns: COLUMNS,
  });
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const normalize = (p: string) => p.replace(/\s+/g, " ").trim();

  const allParamsForSite = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter((row) => row.Name === siteName.name)
          .map((row) =>
            normalize(String(row.ParamName2 ?? row.ParamName ?? "").trim())
          )
      )
    );
  }, [rows, siteName.name]);

  const options = useMemo(() => {
    return allParamsForSite.map((param) => {
      return {
        value: param,
        label: param,
      };
    });
  }, [allParamsForSite]);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <form>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="mt-2 px-2 py-1 bg-gray-900 text-white rounded-xl"
          >
            View Boxplot of Different Parameters
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Boxplot of Different Parameters</DialogTitle>
            <DialogDescription>
              Click on the dropdown menu below to select one or more parameters
              (up to 5) to start.
            </DialogDescription>
          </DialogHeader>

          <MultiSelect
            options={options}
            onValueChange={setSelectedValues}
            defaultValue={selectedValues}
            modalPopover={true}
            popoverClassName="z-[10000]"
          />

          {dialogOpen && (
            <BoxPlotSingleSite
              key={`${siteName.name}-${selectedValues.join(",")}`}
              siteName={siteName.name}
              targetParam={selectedValues}
              height={460}
            />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}
