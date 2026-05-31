import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  listOrders,
  listAllOrders,
  getOrder,
  acknowledgeOrder,
  shipOrderLines,
  cancelOrderLines,
  refundOrderLines,
} from '@walmart-mcp/core';
import type { WalmartCreds, WalmartShipment, OrderStatus } from '@walmart-mcp/core';

export const ORDER_TOOLS: Tool[] = [
  {
    name: 'walmart_list_orders',
    description:
      'List Walmart Marketplace orders with optional filters. Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['Created', 'Acknowledged', 'Shipped', 'Delivered', 'Cancelled', 'Refund'],
          description: 'Filter by order status',
        },
        sku: { type: 'string', description: 'Filter by SKU' },
        customerOrderId: { type: 'string' },
        createdStartDate: { type: 'string', description: 'ISO8601 start date' },
        createdEndDate: { type: 'string', description: 'ISO8601 end date' },
        fromExpectedShipDate: { type: 'string', description: 'ISO8601' },
        toExpectedShipDate: { type: 'string', description: 'ISO8601' },
        limit: { type: 'number', description: 'Results per page (default 200)' },
        nextCursor: { type: 'string', description: 'Cursor from previous page' },
      },
    },
  },
  {
    name: 'walmart_list_all_orders',
    description: 'Fetch ALL Walmart orders matching filters by auto-paginating.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['Created', 'Acknowledged', 'Shipped', 'Delivered', 'Cancelled', 'Refund'],
        },
        sku: { type: 'string' },
        createdStartDate: { type: 'string', description: 'ISO8601 start date' },
        createdEndDate: { type: 'string', description: 'ISO8601 end date' },
      },
    },
  },
  {
    name: 'walmart_get_order',
    description: 'Get a single Walmart order by purchaseOrderId.',
    inputSchema: {
      type: 'object',
      required: ['purchaseOrderId'],
      properties: {
        purchaseOrderId: { type: 'string' },
      },
    },
  },
  {
    name: 'walmart_acknowledge_order',
    description:
      'Acknowledge receipt of a Walmart order. Required within 4 hours of order creation.',
    inputSchema: {
      type: 'object',
      required: ['purchaseOrderId'],
      properties: {
        purchaseOrderId: { type: 'string' },
      },
    },
  },
  {
    name: 'walmart_ship_order',
    description: 'Mark order lines as shipped with tracking information.',
    inputSchema: {
      type: 'object',
      required: ['purchaseOrderId', 'shipments'],
      properties: {
        purchaseOrderId: { type: 'string' },
        shipments: {
          type: 'array',
          items: {
            type: 'object',
            required: ['lineNumber', 'shipDateTime', 'carrierName', 'trackingNo', 'methodCode'],
            properties: {
              lineNumber: { type: 'string' },
              shipDateTime: { type: 'string', description: 'ISO8601 ship timestamp' },
              carrierName: { type: 'string', description: 'e.g. "UPS", "USPS", "FedEx"' },
              trackingNo: { type: 'string' },
              trackingUrl: { type: 'string' },
              methodCode: {
                type: 'string',
                description: 'e.g. "Standard", "Express", "OneDay"',
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'walmart_cancel_order',
    description: 'Cancel one or more order lines.',
    inputSchema: {
      type: 'object',
      required: ['purchaseOrderId', 'lineNumbers'],
      properties: {
        purchaseOrderId: { type: 'string' },
        lineNumbers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Line numbers to cancel',
        },
        reason: {
          type: 'string',
          description: 'Cancellation reason code (default CANCEL_BY_SELLER)',
        },
      },
    },
  },
  {
    name: 'walmart_refund_order',
    description: 'Issue a refund for one or more order lines.',
    inputSchema: {
      type: 'object',
      required: ['purchaseOrderId', 'lineNumbers'],
      properties: {
        purchaseOrderId: { type: 'string' },
        lineNumbers: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string', description: 'Refund reason (default CUSTOMER_RETURNED_ITEM)' },
      },
    },
  },
];

export async function handleOrderTool(
  name: string,
  args: Record<string, unknown>,
  creds: WalmartCreds,
): Promise<unknown> {
  switch (name) {
    case 'walmart_list_orders':
      return listOrders(creds, {
        status: args['status'] as OrderStatus | undefined,
        sku: args['sku'] as string | undefined,
        customerOrderId: args['customerOrderId'] as string | undefined,
        createdStartDate: args['createdStartDate'] as string | undefined,
        createdEndDate: args['createdEndDate'] as string | undefined,
        fromExpectedShipDate: args['fromExpectedShipDate'] as string | undefined,
        toExpectedShipDate: args['toExpectedShipDate'] as string | undefined,
        limit: args['limit'] as number | undefined,
        nextCursor: args['nextCursor'] as string | undefined,
      });

    case 'walmart_list_all_orders':
      return listAllOrders(creds, {
        status: args['status'] as OrderStatus | undefined,
        sku: args['sku'] as string | undefined,
        createdStartDate: args['createdStartDate'] as string | undefined,
        createdEndDate: args['createdEndDate'] as string | undefined,
      });

    case 'walmart_get_order':
      return getOrder(creds, args['purchaseOrderId'] as string);

    case 'walmart_acknowledge_order':
      return acknowledgeOrder(creds, args['purchaseOrderId'] as string);

    case 'walmart_ship_order':
      return shipOrderLines(
        creds,
        args['purchaseOrderId'] as string,
        args['shipments'] as WalmartShipment[],
      );

    case 'walmart_cancel_order':
      return cancelOrderLines(
        creds,
        args['purchaseOrderId'] as string,
        args['lineNumbers'] as string[],
        (args['reason'] as string | undefined) ?? 'CANCEL_BY_SELLER',
      );

    case 'walmart_refund_order':
      return refundOrderLines(
        creds,
        args['purchaseOrderId'] as string,
        args['lineNumbers'] as string[],
        (args['reason'] as string | undefined) ?? 'CUSTOMER_RETURNED_ITEM',
      );

    default:
      throw new Error(`Unknown order tool: ${name}`);
  }
}
