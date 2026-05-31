import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { updateInventory, getInventory, bulkUpdateInventory } from '@walmart-mcp/core';
import type { WalmartCreds, WalmartInventorySpec } from '@walmart-mcp/core';

export const INVENTORY_TOOLS: Tool[] = [
  {
    name: 'walmart_get_inventory',
    description: 'Get current inventory quantity for a single SKU on Walmart Marketplace.',
    inputSchema: {
      type: 'object',
      required: ['sku'],
      properties: {
        sku: { type: 'string', description: 'Seller SKU' },
      },
    },
  },
  {
    name: 'walmart_update_inventory',
    description: 'Update inventory quantity for a single SKU on Walmart Marketplace.',
    inputSchema: {
      type: 'object',
      required: ['sku', 'quantity'],
      properties: {
        sku: { type: 'string', description: 'Seller SKU' },
        quantity: { type: 'number', description: 'New available quantity' },
        unit: { type: 'string', enum: ['EACH'], description: 'Unit of measure (default EACH)' },
      },
    },
  },
  {
    name: 'walmart_bulk_update_inventory',
    description:
      'Bulk update inventory for multiple SKUs via the Walmart inventory feed. Returns feedId.',
    inputSchema: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          description: 'Array of {sku, quantity, unit?} objects',
          items: {
            type: 'object',
            required: ['sku', 'quantity'],
            properties: {
              sku: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string', enum: ['EACH'] },
            },
          },
        },
      },
    },
  },
];

export async function handleInventoryTool(
  name: string,
  args: Record<string, unknown>,
  creds: WalmartCreds,
): Promise<unknown> {
  switch (name) {
    case 'walmart_get_inventory':
      return getInventory(creds, args['sku'] as string);

    case 'walmart_update_inventory':
      return updateInventory(creds, {
        sku: args['sku'] as string,
        quantity: args['quantity'] as number,
        unit: (args['unit'] as 'EACH' | undefined) ?? 'EACH',
      });

    case 'walmart_bulk_update_inventory':
      return bulkUpdateInventory(creds, args['items'] as WalmartInventorySpec[]);

    default:
      throw new Error(`Unknown inventory tool: ${name}`);
  }
}
