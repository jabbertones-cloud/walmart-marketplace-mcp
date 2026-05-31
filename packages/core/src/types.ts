// Shared Walmart Marketplace API types

export interface WalmartCreds {
  clientId: string;
  clientSecret: string;
}

// ── Items ─────────────────────────────────────────────────────────────────────

export type IdentifierType = 'UPC' | 'EAN' | 'GTIN' | 'ISBN' | 'ISSN';

export interface ItemIdentifier {
  productIdType: IdentifierType;
  productId: string;
}

export interface ItemPrice {
  currency: 'USD';
  amount: string; // e.g. "19.99"
}

export interface WalmartItemSpec {
  sku: string;
  /**
   * Real product identifier (UPC/GTIN/EAN). Required UNLESS gtinExempt is true.
   * Use productIdType "EAN" for 13-digit codes (not "GTIN").
   */
  identifier?: ItemIdentifier;
  /**
   * Set true for brand GTIN-exemption: the feed emits productIdType "GTIN"
   * + productId "CUSTOM". Requires an approved Walmart brand GTIN exemption,
   * otherwise the item fails ingestion. If both gtinExempt and identifier
   * are set, gtinExempt takes precedence (CUSTOM is emitted).
   */
  gtinExempt?: boolean;
  productName: string;
  /**
   * Per-product-type. Apparel/jewelry leaves (per Get Spec) require a plain
   * number (e.g. 40.00). Other types may accept { currency, amount }. Pass
   * whichever the product type's spec requires — emitted as-is.
   */
  price: number | ItemPrice;
  /** Short description shown in listing */
  shortDescription?: string;
  brand?: string;
  /** Publicly accessible main image URL */
  mainImageUrl?: string;
  /** Additional image URLs (up to 6) */
  additionalImageUrls?: string[];
  /**
   * Item Spec 5.0 leaf product type NAME (used as the Visible-block key and
   * Orderable.specProductType) — NOT a categoryId.
   * e.g. "Vitamin Supplements", "Lip Balms & Conditioners", "Dietary Supplements".
   * Valid values: GET /v3/items/taxonomy?feedType=MP_ITEM&version=5.0
   * (itemTaxonomy[].productTypeGroup[].productType[].productTypeName).
   * Required — submitItems throws if omitted.
   */
  productType?: string;
  /**
   * Category-specific required Visible attributes, spread into the Visible
   * block as-is. The required set varies per product type — e.g. Vitamin
   * Supplements requires gender, ageGroup, condition, hasWrittenWarranty,
   * vitaminAndSupplementType, labelImage, countryOfOriginSubstantialTransformation.
   * Discover them by submitting and reading the DATA_ERROR field names.
   */
  attributes?: Record<string, unknown>;
  /**
   * Attributes the spec places in the ORDERABLE block (not Visible), spread in
   * as-is with exact spec keys. Most important: country_of_origin_substantial_
   * transformation (required for apparel/textile/footwear). Putting these in
   * `attributes` (Visible) instead silently fails as "required".
   */
  orderableAttributes?: Record<string, unknown>;
  /** Product tax code */
  taxCode?: string;
  /**
   * Shipping weight. Apparel/jewelry leaves (per Get Spec) want a plain number
   * (lbs). Pass the object form { unit, measure } only if a product type's spec
   * requires it. Emitted as-is.
   */
  shippingWeight?: number | { unit: string; measure: number };
  /** Key features (bullet points) */
  keyFeatures?: string[];
  /** Variant attributes: color, size, etc. */
  variantAttributes?: Record<string, string>;
}

export interface WalmartFeedResponse {
  feedId: string;
  additionalAttributes?: Record<string, unknown>;
}

export interface WalmartFeedStatus {
  feedId: string;
  feedType: string;
  partnerId: string;
  processedDate?: string;
  numReceived: number;
  numSucceeded: number;
  numFailed: number;
  numProcessing: number;
  ingestionStatus: 'RECEIVED' | 'INPROGRESS' | 'PROCESSED' | 'ERROR';
  itemsStatus?: WalmartFeedItemStatus[];
}

export interface WalmartFeedItemStatus {
  sku: string;
  index: number;
  ingestionStatus: string;
  ingestionErrors?: Array<{ type: string; description: string }>;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface WalmartInventorySpec {
  sku: string;
  quantity: number;
  unit?: 'EACH';
}

export interface WalmartBulkInventorySpec {
  items: WalmartInventorySpec[];
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type OrderStatus = 'Created' | 'Acknowledged' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Refund';

export interface WalmartOrderLine {
  lineNumber: string;
  item: {
    productName: string;
    sku: string;
  };
  chargeAmount: { currency: string; amount: string };
  orderLineQuantity: { unitOfMeasurement: string; amount: string };
  statusDate: string;
  orderLineStatuses: {
    orderLineStatus: Array<{
      status: OrderStatus;
      statusQuantity: { unitOfMeasurement: string; amount: string };
    }>;
  };
}

export interface WalmartOrder {
  purchaseOrderId: string;
  customerOrderId: string;
  status: OrderStatus;
  orderDate: string;
  shippingInfo: {
    phone: string;
    estimatedDeliveryDate: string;
    estimatedShipDate: string;
    methodCode: string;
    postalAddress: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  orderLines: {
    orderLine: WalmartOrderLine[];
  };
}

export interface WalmartShipment {
  lineNumber: string;
  shipDateTime: string;
  carrierName: string;
  trackingNo: string;
  trackingUrl?: string;
  methodCode: string;
}
