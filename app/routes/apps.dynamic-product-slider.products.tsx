import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

interface ShopifyImage {
  url: string;
  altText: string | null;
}

interface AdminProduct {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  featuredImage: ShopifyImage | null;
  priceRangeV2: {
    minVariantPrice: ShopifyMoney;
  };
}

interface AdminProductsResponse {
  data?: {
    products?: {
      nodes?: AdminProduct[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface AdminCollectionProductsResponse {
  data?: {
    collectionByHandle?: {
      id: string;
      title: string;
      products?: {
        nodes?: AdminProduct[];
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
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
  "featured",
  "recently_purchased",
  "recently_viewed",
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
const RECENTLY_PURCHASED_DAYS = 3;
const MONTHLY_BEST_SELLER_DAYS = 30;
const ORDER_POOL_SIZE = 100;
const ADMIN_API_VERSION = "2026-04";
const EXCLUDED_PRODUCT_LEGACY_IDS = new Set([
  "7042936307815",
  "15044461691249",
  "15452834529649",
  "15290252558705",
  "15486762025329",
]);
const EXCLUDED_PRODUCT_TAG = "hidden from search";

function getCacheControl(source: ProductSource): string {
  if (source === "random_products") {
    return "no-store, max-age=0";
  }

  if (source === "recently_purchased") {
    return "public, max-age=300, stale-while-revalidate=300";
  }

  return "public, max-age=60, stale-while-revalidate=300";
}

const PRODUCTS_QUERY = `#graphql
  query DynamicSliderProducts($first: Int!) {
    products(first: $first, query: "status:active") {
      nodes {
        id
        title
        handle
        tags
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
`;

const FEATURED_COLLECTION_PRODUCTS_QUERY = `#graphql
  query FeaturedCollectionProducts($handle: String!, $first: Int!) {
    collectionByHandle(handle: $handle) {
      id
      title
      products(first: $first) {
        nodes {
          id
          title
          handle
          tags
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
              tags
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

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Response(`${name} is not configured.`, { status: 500 });
  }

  return value;
}

function normalizeShopDomain(shop: string): string {
  return shop.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

function assertAllowedShop(request: Request): void {
  const configuredShop = process.env.SHOPIFY_SHOP_DOMAIN;

  if (!configuredShop) {
    return;
  }

  const requestShop = new URL(request.url).searchParams.get("shop");

  if (!requestShop) {
    throw new Response("Missing shop parameter.", { status: 400 });
  }

  if (normalizeShopDomain(requestShop) !== normalizeShopDomain(configuredShop)) {
    throw new Response("Shop is not allowed.", { status: 403 });
  }
}

async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const shopDomain = normalizeShopDomain(requireEnv("SHOPIFY_SHOP_DOMAIN"));
  const accessToken = requireEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
  const response = await fetch(
    `https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    throw new Response("Shopify Admin API request failed.", {
      status: response.status,
    });
  }

  return response.json() as Promise<T>;
}

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

function getLegacyProductId(product: AdminProduct): string {
  return product.id.split("/").pop() || product.id;
}

function isExcludedProduct(product: AdminProduct): boolean {
  const legacyId = getLegacyProductId(product);

  if (EXCLUDED_PRODUCT_LEGACY_IDS.has(legacyId)) {
    return true;
  }

  return product.tags.some(
    (tag) => tag.trim().toLowerCase() === EXCLUDED_PRODUCT_TAG,
  );
}

function filterEligibleProducts(products: AdminProduct[]): AdminProduct[] {
  return products.filter((product) => !isExcludedProduct(product));
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

async function getRandomProducts(limit: number): Promise<DynamicSliderProduct[]> {
  const payload = await adminGraphql<AdminProductsResponse>(PRODUCTS_QUERY, {
    first: RANDOM_PRODUCT_POOL_SIZE,
  });

  if (payload.errors?.length) {
    throw new Response(payload.errors.map((error) => error.message).join("; "), {
      status: 502,
    });
  }

  const products = payload.data?.products?.nodes || [];

  return shuffleProducts(filterEligibleProducts(products))
    .slice(0, limit)
    .map(normalizeAdminProduct);
}

async function getFeaturedProducts({
  collectionHandle,
  limit,
}: {
  collectionHandle: string | null;
  limit: number;
}): Promise<DynamicSliderProduct[]> {
  if (!collectionHandle) {
    return [];
  }

  const payload = await adminGraphql<AdminCollectionProductsResponse>(
    FEATURED_COLLECTION_PRODUCTS_QUERY,
    {
      handle: collectionHandle,
      first: RANDOM_PRODUCT_POOL_SIZE,
    },
  );

  if (payload.errors?.length) {
    throw new Response(payload.errors.map((error) => error.message).join("; "), {
      status: 502,
    });
  }

  const products = payload.data?.collectionByHandle?.products?.nodes || [];

  return shuffleProducts(filterEligibleProducts(products))
    .slice(0, limit)
    .map(normalizeAdminProduct);
}

async function getRecentlyPurchasedProducts(
  limit: number,
): Promise<DynamicSliderProduct[]> {
  const payload = await adminGraphql<AdminOrdersResponse>(
    PURCHASED_PRODUCTS_QUERY,
    {
      first: ORDER_POOL_SIZE,
      query: getOrderSearchQuery(RECENTLY_PURCHASED_DAYS),
    },
  );

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

      if (!product || isExcludedProduct(product) || productsById.has(product.id)) {
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
  limit,
  days,
}: {
  limit: number;
  days: number;
}): Promise<DynamicSliderProduct[]> {
  const payload = await adminGraphql<AdminOrdersResponse>(
    PURCHASED_PRODUCTS_QUERY,
    {
      first: ORDER_POOL_SIZE,
      query: getOrderSearchQuery(days),
    },
  );

  if (payload.errors?.length) {
    throw new Response(payload.errors.map((error) => error.message).join("; "), {
      status: 502,
    });
  }

  const orders = payload.data?.orders?.nodes || [];
  const productsById = new Map<
    string,
    { product: AdminProduct; purchases: number; firstSeenIndex: number }
  >();
  let seenIndex = 0;

  for (const order of orders) {
    for (const lineItem of order.lineItems.nodes || []) {
      const product = lineItem.product;

      if (!product || isExcludedProduct(product)) {
        continue;
      }

      const existing = productsById.get(product.id);

      if (existing) {
        existing.purchases += 1;
      } else {
        productsById.set(product.id, {
          product,
          purchases: 1,
          firstSeenIndex: seenIndex,
        });
        seenIndex += 1;
      }
    }
  }

  return Array.from(productsById.values())
    .sort((a, b) => {
      if (b.purchases !== a.purchases) {
        return b.purchases - a.purchases;
      }

      return a.firstSeenIndex - b.firstSeenIndex;
    })
    .slice(0, limit)
    .map(({ product }) => normalizeAdminProduct(product));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  assertAllowedShop(request);

  const url = new URL(request.url);
  const source = normalizeSource(url.searchParams.get("source"));
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const collectionHandle = url.searchParams.get("collection");
  let products: DynamicSliderProduct[] = [];

  if (source === "featured") {
    products = await getFeaturedProducts({ collectionHandle, limit });
  }

  if (source === "random_products") {
    products = await getRandomProducts(limit);
  }

  if (source === "recently_purchased") {
    products = await getRecentlyPurchasedProducts(limit);
  }

  if (source === "monthly_best_sellers") {
    products = await getPopularPurchasedProducts({
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
        "Cache-Control": getCacheControl(source),
      },
    },
  );
};
