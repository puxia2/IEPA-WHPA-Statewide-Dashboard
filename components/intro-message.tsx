"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";

export default function IntroMessage() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="z-[100000]">
        <DialogTitle className="text-2xl font-bold">
          Welcome to ISWS Water Quality Dashboard
        </DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-3 text-5m">
            <p className="text-lg">
              Hello, and welcome to the Illinois State Water Survey (ISWS) Water
              Quality Dashboard (WQDB). The WQDB provides a current view of the
              ISWS water quality database.{" "}
            </p>
            <p className="text-lg">
              The overview map plots USGS daily-value sites from{" "}
              <strong>usgs_DV_results.parquet</strong>: discharge, gage height,
              and depth to water level across Illinois.
            </p>
            <p className="text-lg">
              Select one or more sites to draw that record. Gage height in the
              lower chart is the live USGS series for{" "}
              <a
                href="https://waterdata.usgs.gov/monitoring-location/USGS-03337000/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
              >
                USGS-03337000 (Boneyard Creek at Urbana, IL)
              </a>
              .
            </p>
            <p className="text-lg">
              The “Heat Map” tab still maps East St. Louis concentration
              contours. Those concentrations are in parts per billion (ppb).
            </p>
            {/* <p className="text-lg">…</p> */}
            {/* <p className="text-lg">
              This dashboard is currently under development.
            </p> */}
          </div>
        </DialogDescription>
        <Button onClick={() => setOpen(false)}>Start</Button>
      </DialogContent>
    </Dialog>
  );
}
