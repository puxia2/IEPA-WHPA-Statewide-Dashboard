This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Reading data from the object store

The dashboard's datasets are published to the `ot-data-catalog` S3 bucket as
Parquet by `modules/csv_to_parquet_s3.py`. The browser reads them through a
proxy route so that the object store credentials stay on the server.

Copy `.env.example` to `.env` and fill in the keys (in production, supply the
same names as environment variables):

```
S3_ENDPOINT=https://ncsa.osn.xsede.org
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

### The proxy route

`GET /api/data/<name>.parquet` signs a request to the bucket server-side and
streams the object back. Requests are resolved beneath `S3_PREFIX` (`tlpa/wq`)
and must end in `.parquet`, so the route cannot be used to read anything else in
the bucket. Credentials are never sent to the browser, and no presigned URL is
handed out either — the bytes travel through node.

`Range`, `If-None-Match` and `If-Modified-Since` are forwarded to the bucket, and
`HEAD` is answered from `HeadObject`. This matters: a Parquet reader asks for the
object length, then reads the footer and individual column chunks with `Range`
requests. Break range support and every read degrades to a whole-file download.

### Reading it from a component

```tsx
import { useParquetData } from "@/components/parquet-reader";

type Row = { Station_ID: string; Start_Date: Date; Result_Value: number };

const { rows, loading, error } = useParquetData<Row>("EStL_AllDataJoin2", {
  columns: ["Station_ID", "Start_Date", "Result_Value"],
});
```

`useParquetData` returns `{ rows, loading, error }` and takes a dataset name
rather than a path. Three things to know:

- **Naming the columns you need is worth it.** Parquet is columnar, so the map's
  eight-column read of `EStL_AllDataJoin2` transfers about 690 KB rather than the
  full 973 KB object — against 56.7 MB for the equivalent CSV.
- **Types are real, not guessed.** Where papaparse guessed types from text with
  `dynamicTyping`, Parquet carries its own, so a date column arrives as a `Date`
  object. Those dates are **UTC midnight**, so read them with `getUTC*` —
  `lib/date.ts` does. Formatting them locally shifts every sample a day earlier
  in Illinois. Integer columns arrive as bigint, which React cannot render; the
  hook converts those to numbers for you.
- **Columns absent from a dataset are ignored, not an error.** That is what lets
  a call site ask for both `ParamName2` and `ParamName` and use whichever the
  dataset carries.

Reads are deduplicated per dataset and column set, because the overview map
mounts a plot per site popup and they would otherwise each fetch the same file.

There is also a plain `readParquet<T>(dataset, options)` for use outside React.

Every plot now reads through the proxy; nothing fetches the CSVs in `public/`,
which are only an input to the publishing script.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
