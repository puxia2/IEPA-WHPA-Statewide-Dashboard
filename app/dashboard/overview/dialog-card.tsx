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
import BoxPlotSingleSite from "@/plots/box-plot-single-site";

interface SiteParameter {
  key: string;
  label: string;
  count: number;
}

interface Site {
  name: string;
  station_id: number;
  organization: string;
  lat: number;
  lng: number;
  depth_qual: string;
  parameters: SiteParameter[];
}

export function DialogCard({ siteName }: { siteName: Site }) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const options = useMemo(() => {
    return siteName.parameters.map((param) => ({
      value: param.key,
      label: param.label,
    }));
  }, [siteName.parameters]);

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
