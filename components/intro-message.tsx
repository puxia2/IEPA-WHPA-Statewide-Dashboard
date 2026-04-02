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
              For the moment, this database focuses on water quality samples
              that were collected in the East St. Louis, IL and Sauget, IL
              areas.
            </p>
            <p className="text-lg">
              On the left side of the page, there are multiple tabs for
              different ways to view the data. For example, the “Overview” tab
              displays a map of sampling locations paired with two time series
              plots, one of the selected site and contaminant time-series and
              the other of the nearby Mississippi River gage. This view should
              promote analysis of contaminant trends through time compared
              against the river’s physical dynamics.
            </p>
            <p className="text-lg">
              NOTE: Unless otherwise specified, all concentration data is
              presented in parts per billion (ppb).{" "}
            </p>
            <p className="text-lg">…</p>
            <p className="text-lg">
              This dashboard is currently under development.
            </p>
          </div>
        </DialogDescription>
        <Button onClick={() => setOpen(false)}>Start</Button>
      </DialogContent>
    </Dialog>
  );
}
