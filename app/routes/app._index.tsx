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
                  Dynamic Product Slider Sources
                </Text>
                <List>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Featured collection:
                    </Text>
                    Pulls products from the collection selected in the theme
                    editor, shuffles them on each request, and returns the
                    configured number of products.
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Monthly best sellers:
                    </Text>
                    Looks at orders processed in the last 30 days, counts each
                    line item as one purchase regardless of quantity, and returns
                    the products with the most purchase occurrences first.
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Recently purchased products:
                    </Text>
                    Looks at orders processed in the last 3 days, sorted newest
                    first, and returns unique products in most-recent purchase
                    order.
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Random products:
                    </Text>
                    Pulls up to 100 active products from Shopify, shuffles them
                    on each request, and returns the configured number of
                    products.
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
