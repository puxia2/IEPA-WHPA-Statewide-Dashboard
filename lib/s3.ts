import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Server-side object store configuration.
 *
 * Nothing here reaches the browser. The module is `server-only`, and the
 * /api/data route streams object bytes through node rather than handing the
 * client credentials or a presigned URL.
 *
 * Locally these come from the gitignored .env, which Next loads automatically.
 * In production they are supplied as environment variables. Only names starting
 * with NEXT_PUBLIC_ are exposed to the client bundle, so S3_ACCESS_KEY and
 * S3_SECRET_KEY stay on the server by construction.
 */

/** Bucket holding the published Parquet datasets. */
export const S3_BUCKET = process.env.S3_BUCKET ?? "ot-data-catalog";

/**
 * Key prefix the proxy is allowed to serve. Every request is resolved beneath
 * this prefix, so a request can never address another part of the bucket.
 * Must match --prefix in modules/csv_to_parquet_s3.py.
 */
export const S3_PREFIX = (process.env.S3_PREFIX ?? "tlpa/wq").replace(
  /^\/+|\/+$/g,
  ""
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        "Set it in .env for local development, or in the deployment environment."
    );
  }
  return value;
}

let client: S3Client | undefined;

/** Lazily built S3 client for the configured endpoint. */
export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: requireEnv("S3_ENDPOINT"),
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: requireEnv("S3_ACCESS_KEY"),
        secretAccessKey: requireEnv("S3_SECRET_KEY"),
      },
      // OSN fronts Ceph, which does not do virtual-host style buckets.
      forcePathStyle: true,
    });
  }
  return client;
}