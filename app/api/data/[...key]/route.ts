// app/api/data/[...key]/route.ts
//
// Streams published Parquet datasets out of the object store without exposing
// credentials to the browser. The client fetches /api/data/<name>.parquet; this
// route signs the request server-side and pipes the bytes back.
//
// Range and conditional requests are forwarded rather than swallowed, because
// Parquet readers depend on them: hyparquet issues a HEAD for the object length
// and then reads the footer and individual column chunks with Range requests,
// so a whole-file download is never needed to plot one column.

import {
  GetObjectCommand,
  HeadObjectCommand,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getS3Client, S3_BUCKET, S3_PREFIX } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PARQUET_CONTENT_TYPE = "application/vnd.apache.parquet";

// Published datasets are immutable in practice but do get republished, so
// revalidate against the ETag rather than trusting a long local expiry.
const CACHE_CONTROL =
  process.env.S3_PROXY_CACHE_CONTROL ?? "public, max-age=300, must-revalidate";

type RouteContext = { params: Promise<{ key: string[] }> };

/**
 * Resolve the URL path segments to a key beneath the configured prefix.
 * Returns null for anything that tries to escape it or is not a Parquet file.
 */
function resolveKey(segments: string[]): string | null {
  if (!segments?.length) return null;

  // Reject traversal and empty/absolute segments before joining. Since the
  // prefix is always prepended and no segment may be "..", the result cannot
  // address anything outside S3_PREFIX.
  const unsafe = segments.some(
    (segment) =>
      !segment || segment === "." || segment === ".." || segment.includes("\\")
  );
  if (unsafe) return null;

  const path = segments.join("/");
  if (!path.endsWith(".parquet")) return null;

  return S3_PREFIX ? `${S3_PREFIX}/${path}` : path;
}

/** Copy through the object metadata a Parquet reader needs. */
function objectHeaders(meta: { ETag?: string; LastModified?: Date }): Headers {
  const headers = new Headers();
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", CACHE_CONTROL);
  // The route only serves .parquet, so ignore whatever generic type the
  // uploader stamped on the object (boto3 leaves binary/octet-stream).
  headers.set("Content-Type", PARQUET_CONTENT_TYPE);
  if (meta.ETag) headers.set("ETag", meta.ETag);
  if (meta.LastModified) {
    headers.set("Last-Modified", meta.LastModified.toUTCString());
  }
  return headers;
}

/** Map an S3 client error onto a response, or rethrow if it isn't one we expect. */
function errorResponse(err: unknown): NextResponse | null {
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  const name = (err as { name?: string })?.name;

  if (status === 304 || name === "NotModified") {
    return new NextResponse(null, { status: 304 }) as NextResponse;
  }
  if (status === 404 || name === "NoSuchKey" || name === "NotFound") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (status === 412 || name === "PreconditionFailed") {
    return new NextResponse(null, { status: 412 }) as NextResponse;
  }
  if (status === 416 || name === "InvalidRange") {
    return new NextResponse(null, { status: 416 }) as NextResponse;
  }
  return null;
}

/** Conditional/range request headers to forward upstream. */
function forwardedConditions(req: Request): Partial<GetObjectCommandInput> {
  const range = req.headers.get("range");
  const ifNoneMatch = req.headers.get("if-none-match");
  const ifModifiedSince = req.headers.get("if-modified-since");

  return {
    ...(range ? { Range: range } : {}),
    ...(ifNoneMatch ? { IfNoneMatch: ifNoneMatch } : {}),
    ...(ifModifiedSince ? { IfModifiedSince: new Date(ifModifiedSince) } : {}),
  };
}

export async function GET(req: Request, { params }: RouteContext) {
  const key = resolveKey((await params).key);
  if (!key) {
    return NextResponse.json({ error: "Invalid dataset path" }, { status: 400 });
  }

  try {
    const result = await getS3Client().send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ...forwardedConditions(req),
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Empty response" }, { status: 502 });
    }

    const headers = objectHeaders(result);
    if (result.ContentLength !== undefined) {
      headers.set("Content-Length", String(result.ContentLength));
    }

    // S3 answers a Range request with 206 and a Content-Range; pass both along
    // so the reader knows it got a partial body and how large the object is.
    let status = 200;
    if (result.ContentRange) {
      headers.set("Content-Range", result.ContentRange);
      status = 206;
    }

    return new NextResponse(result.Body.transformToWebStream(), {
      status,
      headers,
    });
  } catch (err) {
    const mapped = errorResponse(err);
    if (mapped) return mapped;

    console.error(`[api/data] GET ${key} failed:`, err);
    return NextResponse.json(
      { error: "Failed to read dataset" },
      { status: 500 }
    );
  }
}

/**
 * Answer the length probe a Parquet reader makes before its first Range read.
 * Handled with HeadObject so it costs nothing to serve.
 */
export async function HEAD(req: Request, { params }: RouteContext) {
  const key = resolveKey((await params).key);
  if (!key) return new NextResponse(null, { status: 400 });

  try {
    const result = await getS3Client().send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ...forwardedConditions(req),
      })
    );

    const headers = objectHeaders(result);
    if (result.ContentLength !== undefined) {
      headers.set("Content-Length", String(result.ContentLength));
    }

    return new NextResponse(null, { status: 200, headers });
  } catch (err) {
    const mapped = errorResponse(err);
    if (mapped) return new NextResponse(null, { status: mapped.status });

    console.error(`[api/data] HEAD ${key} failed:`, err);
    return new NextResponse(null, { status: 500 });
  }
}