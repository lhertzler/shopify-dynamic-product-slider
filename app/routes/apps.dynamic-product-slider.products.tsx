import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

interface StorefrontMoney {
  amount: string;
  currencyCode: string;
}

interface StorefrontImage {
  url: string;
  altText: string | null;
}

interface StorefrontProduct {
  id: string;
  title: string;
  handle: string;
  onlineStoreUrl: string | null;
  featuredImage: StorefrontImage | null;
  priceRange: {
    minVariantPrice: StorefrontMoney;
  };
}

interface StorefrontProductsResponse {
  data?: {
    products?: {
      nodes?: StorefrontProduct[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface AdminProduct {
  id: string;
  title: string;
  handle: string;
  featuredImage: StorefrontImage | null;
  priceRangeV2: {
    minVariantPrice: StorefrontMoney;
  };
}

interface AdminOrder {
  id: string;
  processedAt: string | null;
  lineItems: {
    nodes?: Array<{
      quantity: number;
      product: AdminProduct | null;
    }>;
  };
}

interface AdminOrdersResponse {
  data?: {
    orders?: {
      nodes?: AdminOrder[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface DynamicSliderProduct {
  id: string;
  title: string;
  handle: string;
  url: string;
  featured_image: string;
  image: string;
  image_alt: string;
  price: number;
  currency_code: string;
}

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
const RANDOM_PRODUCT_POOL_SIZE = 100;
const RECENTLY_PURCHASED_DAYS = 7;
const RECENTLY_POPULAR_DAYS = 7;
const MONTHLY_BEST_SELLER_DAYS = 30;
const ORDER_POOL_SIZE = 100;

interface GraphqlClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

const RANDOM_PRODUCTS_QUERY = `#graphql
  query RandomProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        handle
        onlineStoreUrl
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

const PURCHASED_PRODUCTS_QUERY = `#graphql
  query PurchasedProducts($first: Int!, $query: String!) {
    orders(first: $first, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      nodes {
        id
        processedAt
        lineItems(first: 50) {
          nodes {
            quantity
            product {
              id
              title
              handle
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

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

function toCents(amount: string): number {
  const parsed = Number(amount);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function shuffleProducts<T>(products: T[]): T[] {
  const shuffled = [...products];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function normalizeProduct(product: StorefrontProduct): DynamicSliderProduct {
  const imageUrl = product.featuredImage?.url || "";
  const minVariantPrice = product.priceRange.minVariantPrice;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    url: product.onlineStoreUrl || `/products/${product.handle}`,
    featured_image: imageUrl,
    image: imageUrl,
    image_alt: product.featuredImage?.altText || product.title,
    price: toCents(minVariantPrice.amount),
    currency_code: minVariantPrice.currencyCode,
  };
}

function normalizeAdminProduct(product: AdminProduct): DynamicSliderProduct {
  const imageUrl = product.featuredImage?.url || "";
  const minVariantPrice = product.priceRangeV2.minVariantPrice;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    url: `/products/${product.handle}`,
    featured_image: imageUrl,
    image: imageUrl,
    image_alt: product.featuredImage?.altText || product.title,
    price: toCents(minVariantPrice.amount),
    currency_code: minVariantPrice.currencyCode,
  };
}

function getOrderSearchQuery(days: number): string {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  return `processed_at:>=${start.toISOString()}`;
}

async function getRandomProducts({
  storefront,
  limit,
}: {
  storefront: GraphqlClient | undefined;
  limit: number;
}): Promise<DynamicSliderProduct[]> {
  if (!storefront) {
    throw new Response("Storefront context is unavailable for this shop.", {
      status: 503,
    });
  }

  const response = await storefront.graphql(RANDOM_PRODUCTS_QUERY, {
    variables: {
      first: RANDOM_PRODUCT_POOL_SIZE,
    },
  });
  const payload = (await response.json()) as StorefrontProductsResponse;

  if (payload.errors?.length) {
    throw new Response(payload.errors.map((error) => error.message).join("; "), {
      status: 502,
    });
  }

  const products = payload.data?.products?.nodes || [];

  return shuffleProducts(products).slice(0, limit).map(normalizeProduct);
}

async function getRecentlyPurchasedProducts({
  admin,
  limit,
}: {
  admin: GraphqlClient | undefined;
  limit: number;
}): Promise<DynamicSliderProduct[]> {
  if (!admin) {
    throw new Response("Admin context is unavailable for this shop.", {
      status: 503,
    });
  }

  const response = await admin.graphql(PURCHASED_PRODUCTS_QUERY, {
    variables: {
      first: ORDER_POOL_SIZE,
      query: getOrderSearchQuery(RECENTLY_PURCHASED_DAYS),
    },
  });
  const payload = (await response.json()) as AdminOrdersResponse;

  if (payload.errors?.length) {
    throw new Response(payload.errors.map((error) => error.message).join("; "), {
      status: 502,
    });
  }

  const orders = payload.data?.orders?.nodes || [];
  const productsById = new Map<string, AdminProduct>();

  for (const order of orders) {
    for (const lineItem of order.lineItems.nodes || []) {
      const product = lineItem.product;

      if (!product || productsById.has(product.id)) {
        continue;
      }

      productsById.set(product.id, product);

      if (productsById.size >= limit) {
        return Array.from(productsById.values()).map(normalizeAdminProduct);
      }
    }
  }

  return Array.from(productsById.values()).map(normalizeAdminProduct);
}

async function getPopularPurchasedProducts({
  admin,
  limit,
  days,
}: {
  admin: GraphqlClient | undefined;
  limit: number;
  days: number;
}): Promise<DynamicSliderProduct[]> {
  if (!admin) {
    throw new Response("Admin context is unavailable for this shop.", {
      status: 503,
    });
  }

  const response = await admin.graphql(PURCHASED_PRODUCTS_QUERY, {
    variables: {
      first: ORDER_POOL_SIZE,
      query: getOrderSearchQuery(days),
    },
  });
  const payload = (await response.json()) as AdminOrdersResponse;

  if (payload.errors?.length) {
    throw new Response(payload.errors.map((error) => error.message).join("; "), {
      status: 502,
    });
  }

  const orders = payload.data?.orders?.nodes || [];
  const productsById = new Map<
    string,
    { product: AdminProduct; quantity: number; firstSeenIndex: number }
  >();
  let seenIndex = 0;

  for (const order of orders) {
    for (const lineItem of order.lineItems.nodes || []) {
      const product = lineItem.product;

      if (!product) {
        continue;
      }

      const existing = productsById.get(product.id);

      if (existing) {
        existing.quantity += lineItem.quantity;
      } else {
        productsById.set(product.id, {
          product,
          quantity: lineItem.quantity,
          firstSeenIndex: seenIndex,
        });
        seenIndex += 1;
      }
    }
  }

  return Array.from(productsById.values())
    .sort((a, b) => {
      if (b.quantity !== a.quantity) {
        return b.quantity - a.quantity;
      }

      return a.firstSeenIndex - b.firstSeenIndex;
    })
    .slice(0, limit)
    .map(({ product }) => normalizeAdminProduct(product));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, storefront } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const source = normalizeSource(url.searchParams.get("source"));
  const limit = normalizeLimit(url.searchParams.get("limit"));
  let products: DynamicSliderProduct[] = [];

  if (source === "random_products") {
    products = await getRandomProducts({ storefront, limit });
  }

  if (source === "recently_purchased") {
    products = await getRecentlyPurchasedProducts({ admin, limit });
  }

  if (source === "recently_popular") {
    products = await getPopularPurchasedProducts({
      admin,
      limit,
      days: RECENTLY_POPULAR_DAYS,
    });
  }

  if (source === "monthly_best_sellers") {
    products = await getPopularPurchasedProducts({
      admin,
      limit,
      days: MONTHLY_BEST_SELLER_DAYS,
    });
  }

  return json(
    {
      source,
      limit,
      products,
      handles: products.map((product) => product.handle),
      generatedAt: new Date().toISOString(),
      message: products.length
        ? "Dynamic products loaded."
        : "This dynamic product source has not returned products yet.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
};
