// Walmart Marketplace Inventory API
// PUT  /v3/inventory?sku=          — update single item inventory
// POST /v3/feeds?feedType=inventory — bulk inventory update (feed-based)

import { walmartFetch } from './auth.js';
import type { WalmartCreds, WalmartFeedResponse, WalmartInventorySpec } from './types.js';

export interface WalmartInventoryResponse {
  sku: string;
  quantity: { unit: string; amount: number };
}

export async function updateInventory(
  creds: WalmartCreds,
  spec: WalmartInventorySpec,
): Promise<WalmartInventoryResponse> {
  const payload = {
    sku: spec.sku,
    quantity: {
      unit: spec.unit ?? 'EACH',
      amount: spec.quantity,
    },
  };
  return walmartFetch<WalmartInventoryResponse>(
    creds.clientId,
    creds.clientSecret,
    'PUT',
    `/v3/inventory?sku=${encodeURIComponent(spec.sku)}`,
    payload,
  );
}

export async function getInventory(
  creds: WalmartCreds,
  sku: string,
): Promise<WalmartInventoryResponse> {
  return walmartFetch<WalmartInventoryResponse>(
    creds.clientId,
    creds.clientSecret,
    'GET',
    `/v3/inventory?sku=${encodeURIComponent(sku)}`,
  );
}

function buildInventoryFeedPayload(items: WalmartInventorySpec[]): unknown {
  return {
    InventoryHeader: {
      version: '1.4',
    },
    Inventory: items.map((item) => ({
      sku: item.sku,
      quantity: {
        unit: item.unit ?? 'EACH',
        amount: item.quantity,
      },
    })),
  };
}

export async function bulkUpdateInventory(
  creds: WalmartCreds,
  items: WalmartInventorySpec[],
): Promise<WalmartFeedResponse> {
  if (items.length === 0) throw new Error('bulkUpdateInventory: items array is empty');
  const payload = buildInventoryFeedPayload(items);
  return walmartFetch<WalmartFeedResponse>(
    creds.clientId,
    creds.clientSecret,
    'POST',
    '/v3/feeds?feedType=inventory',
    payload,
  );
}
