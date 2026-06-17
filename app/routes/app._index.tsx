import {
  BlockStack,
  Card,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

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
                  App ready
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
                  Dynamic Product Slider
                </Text>
                <Text as="p" variant="bodyMd">
                  Created by Luke Hertzler.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
