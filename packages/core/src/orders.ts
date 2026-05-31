// Walmart Marketplace Orders API
// GET  /v3/orders                    — list orders (paginated)
// GET  /v3/orders/{purchaseOrderId}  — get single order
// POST /v3/orders/{purchaseOrderId}/acknowledge — acknowledge order
// POST /v3/orders/{purchaseOrderId}/shipping    — ship order lines

import { walmartFetch } from './auth.js';
import type { WalmartCreds, WalmartOrder, WalmartShipment, OrderStatus } from './types.js';

export interface ListOrdersParams {
  sku?: string;
  customerOrderId?: string;
  status?: OrderStatus;
  createdStartDate?: string; // ISO8601
  createdEndDate?: string;
  fromExpectedShipDate?: string;
  toExpectedShipDate?: string;
  limit?: number;
  nextCursor?: string;
}

export interface ListOrdersResponse {
  orders: WalmartOrder[];
  nextCursor: string | null;
  totalResults: number;
}

export async function listOrders(
  creds: WalmartCreds,
  params: ListOrdersParams = {},
): Promise<ListOrdersResponse> {
  const p = new URLSearchParams();
  if (params.sku) p.set('sku', params.sku);
  if (params.customerOrderId) p.set('customerOrderId', params.customerOrderId);
  if (params.status) p.set('status', params.status);
  if (params.createdStartDate) p.set('createdStartDate', params.createdStartDate);
  if (params.createdEndDate) p.set('createdEndDate', params.createdEndDate);
  if (params.fromExpectedShipDate) p.set('fromExpectedShipDate', params.fromExpectedShipDate);
  if (params.toExpectedShipDate) p.set('toExpectedShipDate', params.toExpectedShipDate);
  p.set('limit', String(params.limit ?? 200));
  if (params.nextCursor) p.set('nextCursor', params.nextCursor);

  const res = await walmartFetch<{
    list?: { elements?: { order?: unknown[] }; meta?: { nextCursor?: string; totalCount?: number } };
  }>(creds.clientId, creds.clientSecret, 'GET', `/v3/orders?${p}`);

  const raw = (res.list?.elements?.order ?? []) as WalmartOrder[];
  return {
    orders: raw,
    nextCursor: res.list?.meta?.nextCursor ?? null,
    totalResults: res.list?.meta?.totalCount ?? raw.length,
  };
}

export async function listAllOrders(
  creds: WalmartCreds,
  params: Omit<ListOrdersParams, 'nextCursor'> = {},
): Promise<WalmartOrder[]> {
  const all: WalmartOrder[] = [];
  let cursor: string | undefined;
  do {
    const page = await listOrders(creds, { ...params, nextCursor: cursor });
    all.push(...page.orders);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export async function getOrder(
  creds: WalmartCreds,
  purchaseOrderId: string,
): Promise<WalmartOrder> {
  const res = await walmartFetch<{ order: WalmartOrder }>(
    creds.clientId,
    creds.clientSecret,
    'GET',
    `/v3/orders/${encodeURIComponent(purchaseOrderId)}`,
  );
  return res.order;
}

export async function acknowledgeOrder(
  creds: WalmartCreds,
  purchaseOrderId: string,
): Promise<WalmartOrder> {
  const res = await walmartFetch<{ order: WalmartOrder }>(
    creds.clientId,
    creds.clientSecret,
    'POST',
    `/v3/orders/${encodeURIComponent(purchaseOrderId)}/acknowledge`,
  );
  return res.order;
}

export async function shipOrderLines(
  creds: WalmartCreds,
  purchaseOrderId: string,
  shipments: WalmartShipment[],
): Promise<WalmartOrder> {
  const payload = {
    orderShipment: {
      orderLines: {
        orderLine: shipments.map((s) => ({
          lineNumber: s.lineNumber,
          orderLineStatuses: {
            orderLineStatus: [
              {
                status: 'Shipped',
                statusQuantity: { unitOfMeasurement: 'EACH', amount: '1' },
                trackingInfo: {
                  shipDateTime: s.shipDateTime,
                  carrierName: { otherCarrier: null, carrier: s.carrierName },
                  methodCode: s.methodCode,
                  trackingNumber: s.trackingNo,
                  trackingURL: s.trackingUrl ?? '',
                },
              },
            ],
          },
        })),
      },
    },
  };

  const res = await walmartFetch<{ order: WalmartOrder }>(
    creds.clientId,
    creds.clientSecret,
    'POST',
    `/v3/orders/${encodeURIComponent(purchaseOrderId)}/shipping`,
    payload,
  );
  return res.order;
}

export async function cancelOrderLines(
  creds: WalmartCreds,
  purchaseOrderId: string,
  lineNumbers: string[],
  reason = 'CANCEL_BY_SELLER',
): Promise<WalmartOrder> {
  const payload = {
    orderCancellation: {
      orderLines: {
        orderLine: lineNumbers.map((lineNumber) => ({
          lineNumber,
          orderLineStatuses: {
            orderLineStatus: [
              {
                status: 'Cancelled',
                cancellationReason: reason,
                statusQuantity: { unitOfMeasurement: 'EACH', amount: '1' },
              },
            ],
          },
        })),
      },
    },
  };

  const res = await walmartFetch<{ order: WalmartOrder }>(
    creds.clientId,
    creds.clientSecret,
    'POST',
    `/v3/orders/${encodeURIComponent(purchaseOrderId)}/cancel`,
    payload,
  );
  return res.order;
}

export async function refundOrderLines(
  creds: WalmartCreds,
  purchaseOrderId: string,
  lineNumbers: string[],
  reason = 'CUSTOMER_RETURNED_ITEM',
): Promise<WalmartOrder> {
  const payload = {
    orderRefund: {
      purchaseOrderId,
      orderLines: {
        orderLine: lineNumbers.map((lineNumber) => ({
          lineNumber,
          refunds: {
            refund: [
              {
                refundComments: reason,
                refundCharges: {
                  refundCharge: [
                    {
                      refundReason: reason,
                      charge: {
                        chargeType: 'PRODUCT',
                        chargeName: 'ItemPrice',
                        chargeAmount: { currency: 'USD', amount: '0' },
                        tax: null,
                      },
                    },
                  ],
                },
              },
            ],
          },
        })),
      },
    },
  };

  const res = await walmartFetch<{ order: WalmartOrder }>(
    creds.clientId,
    creds.clientSecret,
    'POST',
    `/v3/orders/${encodeURIComponent(purchaseOrderId)}/refund`,
    payload,
  );
  return res.order;
}
