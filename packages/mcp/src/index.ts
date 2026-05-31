#!/usr/bin/env node
// Walmart Marketplace MCP — stdio server
// Tools: items, inventory, orders (seller-side Walmart Marketplace API v3)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WalmartError } from '@walmart-mcp/core';
import type { WalmartCreds } from '@walmart-mcp/core';
import {
  ITEM_TOOLS,
  INVENTORY_TOOLS,
  ORDER_TOOLS,
  handleItemTool,
  handleInventoryTool,
  handleOrderTool,
} from './tools/index.js';

const ALL_TOOLS = [...ITEM_TOOLS, ...INVENTORY_TOOLS, ...ORDER_TOOLS];

const ITEM_TOOL_NAMES = new Set(ITEM_TOOLS.map((t) => t.name));
const INVENTORY_TOOL_NAMES = new Set(INVENTORY_TOOLS.map((t) => t.name));
const ORDER_TOOL_NAMES = new Set(ORDER_TOOLS.map((t) => t.name));

function getCreds(): WalmartCreds {
  const clientId = process.env['WALMART_CLIENT_ID'];
  const clientSecret = process.env['WALMART_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('WALMART_CLIENT_ID and WALMART_CLIENT_SECRET must be set');
  }
  return { clientId, clientSecret };
}

const server = new Server(
  { name: 'walmart-marketplace-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const creds = getCreds();

  try {
    let result: unknown;

    if (ITEM_TOOL_NAMES.has(name)) {
      result = await handleItemTool(name, args as Record<string, unknown>, creds);
    } else if (INVENTORY_TOOL_NAMES.has(name)) {
      result = await handleInventoryTool(name, args as Record<string, unknown>, creds);
    } else if (ORDER_TOOL_NAMES.has(name)) {
      result = await handleOrderTool(name, args as Record<string, unknown>, creds);
    } else {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const msg =
      err instanceof WalmartError
        ? `Walmart API error ${err.status}: ${err.body}`
        : err instanceof Error
          ? err.message
          : String(err);

    return {
      content: [{ type: 'text', text: msg }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
