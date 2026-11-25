"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export default function Map() {
  const [backendTestResult, setBackendTestResult] = useState<string>("");
  const Map = useMemo(
    () =>
      dynamic(() => import("@/app/dashboard/overview/Map"), {
        loading: () => <p>A map is loading</p>,
        ssr: false,
      }),
    [],
  );

  async function pingBackend() {
    setBackendTestResult("Pinging…");
    try {
      const res = await fetch("http://localhost:8000/api/test-db");
      const data = await res.json();
      setBackendTestResult(JSON.stringify(data));
    } catch (err) {
      setBackendTestResult(
        err instanceof Error ? err.message : "Request failed",
      );
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={pingBackend}>
          Ping backend
        </Button>
        {backendTestResult && (
          <span className="text-muted-foreground">{backendTestResult}</span>
        )}
      </div>
      <div style={{ height: "600px", width: "100%" }}>
        <Map position={[40.110558, -88.228333]} zoom={9} />
      </div>
    </div>
  );
}
