import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  submitItems,
  listItems,
  listAllItems,
  getItem,
  retireItem,
  getFeedStatus,
  listFeeds,
} from '@walmart-mcp/core';
import type { WalmartCreds, WalmartItemSpec } from '@walmart-mcp/core';

export const ITEM_TOOLS: Tool[] = [
  {
    name: 'walmart_submit_items',
    description:
      'Submit one or more items to the Walmart Marketplace catalog via the MP_ITEM feed. ' +
      'Each item needs EITHER a real identifier (UPC/GTIN/EAN) OR gtinExempt:true ' +
      '(brand GTIN-exemption → emits GTIN/CUSTOM). Returns a feedId to poll for status.',
    inputSchema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          description: 'Array of item specs to submit',
          items: {
            type: 'object',
            required: ['sku', 'productName', 'price'],
            properties: {
              sku: { type: 'string', description: 'Seller SKU' },
              identifier: {
                type: 'object',
                description:
                  'Real product identifier. Provide this for items WITH a UPC/GTIN/EAN. Omit and set gtinExempt:true for exemption items.',
                required: ['productIdType', 'productId'],
                properties: {
                  productIdType: {
                    type: 'string',
                    enum: ['UPC', 'EAN', 'GTIN', 'ISBN', 'ISSN'],
                  },
                  productId: { type: 'string' },
                },
              },
              gtinExempt: {
                type: 'boolean',
                description:
                  'Set true for brand GTIN-exemption items (no UPC). Emits productIdType "GTIN" + productId "CUSTOM". Requires an approved Walmart brand GTIN exemption. Takes precedence over identifier.',
              },
              productName: { type: 'string' },
              price: {
                description:
                  'Per product type: apparel/jewelry leaves require a NUMBER (e.g. 40.00); others accept {currency,amount}. Pass whichever the leaf spec requires.',
                oneOf: [
                  { type: 'number' },
                  {
                    type: 'object',
                    required: ['currency', 'amount'],
                    properties: {
                      currency: { type: 'string', enum: ['USD'] },
                      amount: { type: 'string', description: 'e.g. "19.99"' },
                    },
                  },
                ],
              },
              shortDescription: { type: 'string' },
              brand: { type: 'string' },
              mainImageUrl: { type: 'string' },
              additionalImageUrls: { type: 'array', items: { type: 'string' } },
              productType: {
                type: 'string',
                description:
                  'Walmart leaf product type NAME (Visible-block key), e.g. "Vitamin Supplements", "Lip Balms & Conditioners". From GET /v3/items/taxonomy?feedType=MP_ITEM&version=5.0. Required.',
              },
              attributes: {
                type: 'object',
                additionalProperties: true,
                description:
                  'Category-specific required VISIBLE attrs (exact spec keys), e.g. { gender, ageGroup, condition, has_written_warranty, hatStyle, fabricContent, netContent, season, color, colorCategory }. Get exact keys/enums from POST /v3/items/spec. Required set varies per product type.',
              },
              orderableAttributes: {
                type: 'object',
                additionalProperties: true,
                description:
                  'Attrs the spec places in the ORDERABLE block (not Visible). Most important: country_of_origin_substantial_transformation (required for apparel/textile/footwear). Putting these in `attributes` fails as "required".',
              },
              taxCode: { type: 'string' },
              shippingWeight: {
                description: 'Weight in lbs. Number for apparel/jewelry leaves; {unit,measure} only if the leaf spec requires it.',
                oneOf: [{ type: 'number' }, { type: 'object' }],
              },
              keyFeatures: {
                type: 'array',
                items: { type: 'string' },
                description: 'Bullet-point features (up to 5)',
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'walmart_list_items',
    description:
      'List all items in the Walmart Marketplace catalog (paginated). Returns items, totalResults, and nextCursor.',
    inputSchema: {
      type: 'object',
      properties: {
        nextCursor: { type: 'string', description: 'Cursor from previous page' },
        limit: { type: 'number', description: 'Results per page (default 100, max 200)' },
      },
    },
  },
  {
    name: 'walmart_list_all_items',
    description: 'Fetch ALL items from the Walmart catalog by auto-paginating. May be slow for large catalogs.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'walmart_get_item',
    description: 'Get a single item by SKU from the Walmart Marketplace catalog.',
    inputSchema: {
      type: 'object',
      required: ['sku'],
      properties: {
        sku: { type: 'string', description: 'Seller SKU' },
      },
    },
  },
  {
    name: 'walmart_retire_item',
    description:
      'Retire (remove) an item from the Walmart Marketplace catalog by SKU. This is irreversible.',
    inputSchema: {
      type: 'object',
      required: ['sku'],
      properties: {
        sku: { type: 'string', description: 'Seller SKU to retire' },
      },
    },
  },
  {
    name: 'walmart_get_feed_status',
    description:
      'Get the processing status of a Walmart feed (item, inventory, price, etc.) by feedId.',
    inputSchema: {
      type: 'object',
      required: ['feedId'],
      properties: {
        feedId: { type: 'string' },
        includeDetails: {
          type: 'boolean',
          description: 'Include per-item error details (default true)',
        },
      },
    },
  },
  {
    name: 'walmart_list_feeds',
    description: 'List recent Walmart feed submissions, optionally filtered by feedType.',
    inputSchema: {
      type: 'object',
      properties: {
        feedType: {
          type: 'string',
          description: 'e.g. "item", "inventory", "price"',
        },
        limit: { type: 'number', description: 'Number of feeds to return (default 50)' },
      },
    },
  },
];

export async function handleItemTool(
  name: string,
  args: Record<string, unknown>,
  creds: WalmartCreds,
): Promise<unknown> {
  switch (name) {
    case 'walmart_submit_items':
      return submitItems(creds, args['items'] as WalmartItemSpec[]);

    case 'walmart_list_items':
      return listItems(
        creds,
        args['nextCursor'] as string | undefined,
        (args['limit'] as number | undefined) ?? 100,
      );

    case 'walmart_list_all_items':
      return listAllItems(creds);

    case 'walmart_get_item':
      return getItem(creds, args['sku'] as string);

    case 'walmart_retire_item':
      return retireItem(creds, args['sku'] as string);

    case 'walmart_get_feed_status':
      return getFeedStatus(
        creds,
        args['feedId'] as string,
        (args['includeDetails'] as boolean | undefined) ?? true,
      );

    case 'walmart_list_feeds':
      return listFeeds(
        creds,
        args['feedType'] as string | undefined,
        (args['limit'] as number | undefined) ?? 50,
      );

    default:
      throw new Error(`Unknown item tool: ${name}`);
  }
}
