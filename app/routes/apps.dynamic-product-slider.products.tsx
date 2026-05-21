import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const SOURCE_VALUES = [
  "recently_purchased",
  "recently_viewed",
  "recently_popular",
  "monthly_best_sellers",
  "random_products",
  "manual",
] as const;

type ProductSource = (typeof SOURCE_VALUES)[number];

const SOURCES = new Set<string>(SOURCE_VALUES);
const DEFAULT_SOURCE: ProductSource = "manual";
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 15;

function normalizeSource(value: string | null): ProductSource {
  if (value && SOURCES.has(value)) {
    return value as ProductSource;
  }

  return DEFAULT_SOURCE;
}

function normalizeLimit(value: string | null): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const source = normalizeSource(url.searchParams.get("source"));
  const limit = normalizeLimit(url.searchParams.get("limit"));

  return json(
    {
      source,
      limit,
      products: [],
      handles: [],
      generatedAt: new Date().toISOString(),
      message: "Dynamic product source endpoint is ready. Aggregation has not been implemented yet.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
};
