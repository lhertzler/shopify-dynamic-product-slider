# Dynamic Product Slider

Single-store Shopify app for the Dwarven Forge storefront. The app provides a theme app extension section that renders dynamic homepage product lists through a Shopify app proxy endpoint.

This is not intended for Shopify App Store distribution.

## Architecture

- Theme app extension block: `extensions/dynamic-product-slider/blocks/dynamic_product_slider.liquid`
- Storefront assets: `extensions/dynamic-product-slider/assets/`
- App proxy endpoint: `/apps/dynamic-product-slider/products`
- Product data source: Shopify Admin GraphQL using a one-store Admin API token stored in environment variables
- Session database: none

## Implemented Sources

- Random products
- Featured collection
- Recently purchased products
- Monthly best sellers

## Pending Source

- Store-wide recently viewed products

This still requires view tracking and persistent storage if we decide to build it.

## Required Environment Variables

```shell
SHOPIFY_API_KEY=97e19199c884c275aa234720c5ce8838
SHOPIFY_API_SECRET=<client-secret-from-shopify-partner-app>
SHOPIFY_APP_URL=https://<deployed-app-domain>
SCOPES=write_app_proxy
SHOPIFY_SHOP_DOMAIN=<store>.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=<admin-api-access-token-from-store-custom-app>
```

## Shopify Admin Custom App Token

Create a custom app in the target store admin for data access:

1. Create a custom app in the target Shopify store.
2. Grant Admin API scopes:
   - `read_products`
   - `read_orders`
3. Install the custom app.
4. Copy its Admin API access token into `SHOPIFY_ADMIN_ACCESS_TOKEN` in the hosting provider.

## Shopify Partner App / Theme Extension

The Partner/CLI app still owns the theme app extension and app proxy configuration.

Before deploying:

1. Replace `https://example.com` in `shopify.app.toml` with the deployed app URL.
2. Set the same deployed URL in `SHOPIFY_APP_URL`.
3. Validate config:

```shell
shopify app config validate --json
```

4. Deploy app config and extension:

```shell
shopify app deploy
```

5. Add the `Dynamic product slider` app block to a draft theme in the Shopify theme editor.

## Development

Install dependencies:

```shell
npm install
```

Run locally:

```shell
npm run dev
```

Validate:

```shell
npm exec tsc -- --noEmit
npm run build
npm run lint
npm audit --omit=dev
shopify app config validate --json
shopify app build
```
