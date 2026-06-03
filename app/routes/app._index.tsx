import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  BlockStack,
  Card,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="Dynamic Product Slider" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  App foundation is ready
                </Text>
                <Text as="p" variant="bodyMd">
                  This app now owns the storefront block and the app proxy route
                  that will power the dynamic homepage product slider.
                </Text>
                <List>
                  <List.Item>
                    Theme app extension:{" "}
                    <Text as="span" fontWeight="semibold">
                      extensions/dynamic-product-slider
                    </Text>
                  </List.Item>
                  <List.Item>
                    Storefront endpoint:{" "}
                    <Text as="span" fontWeight="semibold">
                      /apps/dynamic-product-slider/products
                    </Text>
                  </List.Item>
                  <List.Item>
                    Implemented sources: random products and recently purchased
                    products, recently popular products, and monthly best
                    sellers.
                  </List.Item>
                  <List.Item>
                    Pending source: store-wide recently viewed.
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Next build phase
                </Text>
                <Text as="p" variant="bodyMd">
                  Add storefront view tracking and aggregation for store-wide
                  recently viewed products.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
