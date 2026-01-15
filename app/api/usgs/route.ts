// app/api/usgs/route.ts
import { NextResponse } from "next/server";

const USGS_BASE = "https://nwis.waterservices.usgs.gov/nwis";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const service = searchParams.get("service") ?? "iv";
    if (service !== "iv" && service !== "dv") {
      return NextResponse.json(
        { error: `Invalid service: ${service}` },
        { status: 400 }
      );
    }

    // note: trailing slash
    const targetUrl = new URL(`${USGS_BASE}/${service}/`);

    searchParams.forEach((value, key) => {
      if (key === "service") return;
      targetUrl.searchParams.append(key, value);
    });

    // if the frontend has already set format=json, this line will not hurt; if not, it will add it
    targetUrl.searchParams.set(
      "format",
      targetUrl.searchParams.get("format") ?? "json"
    );

    const resp = await fetch(targetUrl.toString(), { cache: "no-store" });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
