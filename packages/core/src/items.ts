// Walmart Marketplace Items API
// POST /v3/feeds?feedType=MP_ITEM  — create/update items (Item Spec 5.0, multipart)
// GET  /v3/items                   — list all items (paginated)
// GET  /v3/items/{sku}             — get single item
// PUT  /v3/items/{sku}/retire      — retire item

import { walmartFetch, walmartFeedPost } from './auth.js';
import type {
  WalmartCreds,
  WalmartFeedResponse,
  WalmartFeedStatus,
  WalmartItemSpec,
} from './types.js';

/**
 * Build Item Spec 5.0 MP_ITEM payload.
 *
 * Key facts (verified against the live feed validator, 2026-05):
 * - Submitted as multipart/form-data (see walmartFeedPost) — NOT raw JSON.
 *   Walmart's feed parser selects JSON vs XML by the filename extension.
 * - Header uses version/businessUnit (not sellingChannel/mart).
 * - Each item is split into Orderable (fulfilment) + Visible (display) blocks.
 * - The Visible block is keyed by the leaf **product type name**, not a
 *   categoryId. e.g. "Vitamin Supplements", "Lip Balms & Conditioners".
 *   A categoryId like "personal_care" matches no product type and triggers a
 *   cascade of bogus required-attribute errors across unrelated categories.
 *   Valid product type names: GET /v3/items/taxonomy?feedType=MP_ITEM&version=5.0
 *   (itemTaxonomy[].productTypeGroup[].productType[].productTypeName).
 * - productName lives in the Visible block, NOT Orderable — Orderable rejects
 *   it with "'productName' is not a valid field".
 * - Category-specific required attrs (e.g. gender, ageGroup, condition,
 *   vitaminAndSupplementType, hasWrittenWarranty, labelImage,
 *   countryOfOriginSubstantialTransformation) vary per product type and are
 *   supplied by the caller via item.attributes, spread into the Visible block.
 * - Use productIdType "EAN" for 13-digit EAN codes (not "GTIN") — submitting
 *   a 13-digit code as GTIN causes Walmart to resolve wrong catalog products.
 */
function buildMPItemPayload(items: WalmartItemSpec[]): unknown {
  return {
    MPItemFeedHeader: {
      // Per the live Get Spec, the ONLY valid header fields are locale,
      // version, businessUnit (all required). feedDate, processMode, and
      // requestBatchSize are all rejected ("not a valid field").
      locale: 'en',
      version: '5.0.20260205-21_38_48-api',
      businessUnit: 'WALMART_US',
    },
    MPItem: items.map((item) => {
      const productType = item.productType;
      if (!productType) {
        throw new Error(
          `submitItems: item "${item.sku}" is missing productType. ` +
            'Set it to a Walmart leaf product type name (e.g. "Vitamin Supplements"). ' +
            'Valid values: GET /v3/items/taxonomy?feedType=MP_ITEM&version=5.0',
        );
      }

      // Product identifier: real UPC/GTIN/EAN, OR brand GTIN-exemption.
      // Per the live spec, productIdType enum = EAN|GTIN|ISBN|UPC ("CUSTOM" is
      // NOT a valid productIdType). For an approved brand GTIN exemption, send
      // productIdType "GTIN" + productId "CUSTOM" (verified: this clears the
      // productIdentifiers validation). "CUSTOM" fails ingestion if the brand
      // is not actually exempt.
      let productIdentifiers: { productIdType: string; productId: string };
      if (item.gtinExempt) {
        productIdentifiers = { productIdType: 'GTIN', productId: 'CUSTOM' };
      } else if (item.identifier) {
        productIdentifiers = {
          productIdType: item.identifier.productIdType,
          productId: item.identifier.productId,
        };
      } else {
        throw new Error(
          `submitItems: item "${item.sku}" needs an identifier ` +
            '(productIdType + productId, e.g. a real UPC/GTIN) OR gtinExempt:true ' +
            '(uses GTIN/CUSTOM — requires an approved Walmart brand GTIN exemption).',
        );
      }

      const visibleAttrs: Record<string, unknown> = {
        productName: item.productName,
        brand: item.brand ?? '',
        shortDescription: item.shortDescription ?? item.productName,
        mainImageUrl: item.mainImageUrl ?? '',
        condition: 'New',
        isProp65WarningRequired: 'No',
        ...(item.additionalImageUrls?.length
          ? { productSecondaryImageURL: item.additionalImageUrls.slice(0, 6) }
          : {}),
        ...(item.keyFeatures?.length ? { keyFeatures: item.keyFeatures.slice(0, 5) } : {}),
        // Category-specific required attrs (gender, ageGroup, labelImage, etc.)
        ...(item.attributes ?? {}),
      };

      // price/ShippingWeight format is per-product-type. Apparel/jewelry leaves
      // (per Get Spec) want a plain NUMBER; some other types accept the
      // {currency,amount} / {unit,measure} objects. Pass a number for the
      // number form, or the object for the object form — emitted as-is.
      const price =
        typeof item.price === 'number'
          ? item.price
          : { currency: item.price.currency, amount: item.price.amount };
      const shippingWeight =
        typeof item.shippingWeight === 'object' && item.shippingWeight !== null
          ? item.shippingWeight
          : item.shippingWeight; // number passes through

      return {
        Orderable: {
          sku: item.sku,
          specProductType: productType,
          productIdentifiers,
          price,
          ...(shippingWeight !== undefined ? { ShippingWeight: shippingWeight } : {}),
          ...(item.taxCode ? { productTaxCode: item.taxCode } : {}),
          // Orderable-level attrs that the spec places in Orderable, NOT Visible
          // — most importantly country_of_origin_substantial_transformation
          // (apparel/textile/footwear). Caller supplies exact spec keys.
          ...(item.orderableAttributes ?? {}),
        },
        Visible: {
          [productType]: visibleAttrs,
        },
      };
    }),
  };
}

export async function submitItems(
  creds: WalmartCreds,
  items: WalmartItemSpec[],
): Promise<WalmartFeedResponse> {
  if (items.length === 0) throw new Error('submitItems: items array is empty');
  const payload = buildMPItemPayload(items);
  return walmartFeedPost<WalmartFeedResponse>(
    creds.clientId,
    creds.clientSecret,
    '/v3/feeds?feedType=MP_ITEM',
    payload,
  );
}

export interface WalmartItemSummary {
  sku: string;
  productName?: string;
  publishedStatus?: string;
  lifecycleStatus?: string;
  price?: { currency: string; amount: number };
  upc?: string;
}

export async function listItems(
  creds: WalmartCreds,
  nextCursor?: string,
  limit = 100,
): Promise<{ items: WalmartItemSummary[]; nextCursor: string | null; totalResults: number }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (nextCursor) params.set('nextCursor', nextCursor);
  const res = await walmartFetch<{
    ItemResponse?: unknown[];
    nextCursor?: string;
    totalResults?: number;
  }>(creds.clientId, creds.clientSecret, 'GET', `/v3/items?${params}`);

  const raw = (res.ItemResponse ?? []) as Record<string, unknown>[];
  const items: WalmartItemSummary[] = raw.map((r) => ({
    sku: String(r['sku'] ?? ''),
    productName: r['productName'] as string | undefined,
    publishedStatus: r['publishedStatus'] as string | undefined,
    lifecycleStatus: r['lifecycleStatus'] as string | undefined,
    price: r['price'] as WalmartItemSummary['price'],
    upc: (r['productIdentifiers'] as Record<string, string> | undefined)?.['productId'],
  }));

  return {
    items,
    nextCursor: res.nextCursor ?? null,
    totalResults: res.totalResults ?? items.length,
  };
}

export async function listAllItems(creds: WalmartCreds): Promise<WalmartItemSummary[]> {
  const all: WalmartItemSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await listItems(creds, cursor);
    all.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export async function getItem(creds: WalmartCreds, sku: string): Promise<unknown> {
  return walmartFetch<unknown>(
    creds.clientId,
    creds.clientSecret,
    'GET',
    `/v3/items/${encodeURIComponent(sku)}`,
  );
}

export async function retireItem(creds: WalmartCreds, sku: string): Promise<unknown> {
  // Walmart "Retire an Item" is DELETE /v3/items/{sku} — NOT PUT /v3/items/{sku}/retire
  // (the /retire path 404s as "No static resource ... /retire").
  return walmartFetch<unknown>(
    creds.clientId,
    creds.clientSecret,
    'DELETE',
    `/v3/items/${encodeURIComponent(sku)}`,
  );
}

export async function getFeedStatus(
  creds: WalmartCreds,
  feedId: string,
  includeDetails = true,
): Promise<WalmartFeedStatus> {
  const params = new URLSearchParams({ includeDetails: String(includeDetails) });
  return walmartFetch<WalmartFeedStatus>(
    creds.clientId,
    creds.clientSecret,
    'GET',
    `/v3/feeds/${encodeURIComponent(feedId)}?${params}`,
  );
}

export async function listFeeds(
  creds: WalmartCreds,
  feedType?: string,
  limit = 50,
): Promise<unknown> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (feedType) params.set('feedType', feedType);
  return walmartFetch<unknown>(creds.clientId, creds.clientSecret, 'GET', `/v3/feeds?${params}`);
}
