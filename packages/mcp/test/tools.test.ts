import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { INVENTORY_TOOLS, handleInventoryTool } from '../src/tools/inventory.js';
import { WalmartError } from '@walmart-mcp/core';
import {
  installRig,
  uninstallRig,
  apiCalls,
  stub,
  freshClient,
} from '../../core/test/helpers.js';

beforeEach(installRig);
afterEach(uninstallRig);

const creds = () => ({ clientId: freshClient(), clientSecret: 's' });

describe('INVENTORY_TOOLS', () => {
  it('declares the three inventory tools with required fields', () => {
    const names = INVENTORY_TOOLS.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'walmart_bulk_update_inventory',
      'walmart_get_inventory',
      'walmart_update_inventory',
    ]);
    for (const tool of INVENTORY_TOOLS) {
      assert.ok(tool.description, `${tool.name} needs a description`);
      assert.equal((tool.inputSchema as { type: string }).type, 'object');
    }
  });
});

describe('handleInventoryTool', () => {
  it('routes walmart_update_inventory with the expected PUT request shape', async () => {
    stub.apiBody = { sku: 'SKU-1', quantity: { unit: 'EACH', amount: 5 } };
    const out = await handleInventoryTool(
      'walmart_update_inventory',
      { sku: 'SKU-1', quantity: 5 },
      creds(),
    );
    assert.equal(apiCalls.length, 1);
    const call = apiCalls[0];
    assert.equal(call.init.method, 'PUT');
    assert.equal(call.url, 'https://marketplace.walmartapis.com/v3/inventory?sku=SKU-1');
    assert.deepEqual(JSON.parse(call.init.body as string), {
      sku: 'SKU-1',
      quantity: { unit: 'EACH', amount: 5 },
    });
    assert.deepEqual(out, stub.apiBody);
  });

  it('maps provider errors to WalmartError', async () => {
    stub.apiStatus = 401;
    stub.apiBody = 'unauthorized';
    await assert.rejects(
      () => handleInventoryTool('walmart_get_inventory', { sku: 'SKU-1' }, creds()),
      (e: unknown) => {
        assert.ok(e instanceof WalmartError);
        assert.equal(e.status, 401);
        return true;
      },
    );
  });

  it('throws on an unknown tool name', async () => {
    await assert.rejects(
      () => handleInventoryTool('walmart_nope', {}, creds()),
      /Unknown inventory tool: walmart_nope/,
    );
    assert.equal(apiCalls.length, 0);
  });
});
