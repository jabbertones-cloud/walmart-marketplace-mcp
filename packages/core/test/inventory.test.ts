import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { updateInventory, getInventory, bulkUpdateInventory } from '../src/inventory.js';
import { WalmartError } from '../src/auth.js';
import {
  installRig,
  uninstallRig,
  apiCalls,
  stub,
  freshClient,
} from './helpers.js';

beforeEach(installRig);
afterEach(uninstallRig);

const creds = () => ({ clientId: freshClient(), clientSecret: 's' });

describe('updateInventory', () => {
  it('PUTs the expected payload shape to /v3/inventory', async () => {
    stub.apiBody = { sku: 'SKU-1', quantity: { unit: 'EACH', amount: 5 } };
    const out = await updateInventory(creds(), { sku: 'SKU-1', quantity: 5 });
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

  it('URL-encodes the sku in the query string', async () => {
    stub.apiBody = { sku: 'A B', quantity: { unit: 'EACH', amount: 1 } };
    await updateInventory(creds(), { sku: 'A B', quantity: 1 });
    assert.ok(apiCalls[0].url.endsWith('/v3/inventory?sku=A%20B'));
  });

  it('maps API errors to WalmartError', async () => {
    stub.apiStatus = 400;
    stub.apiBody = 'invalid quantity';
    await assert.rejects(
      () => updateInventory(creds(), { sku: 'SKU-1', quantity: -1 }),
      (e: unknown) => {
        assert.ok(e instanceof WalmartError);
        assert.equal(e.status, 400);
        assert.equal(e.body, 'invalid quantity');
        return true;
      },
    );
  });
});

describe('getInventory', () => {
  it('GETs /v3/inventory with the encoded sku', async () => {
    stub.apiBody = { sku: 'SKU-9', quantity: { unit: 'EACH', amount: 7 } };
    const out = await getInventory(creds(), 'SKU-9');
    assert.equal(apiCalls[0].init.method, 'GET');
    assert.equal(apiCalls[0].url, 'https://marketplace.walmartapis.com/v3/inventory?sku=SKU-9');
    assert.deepEqual(out, stub.apiBody);
  });
});

describe('bulkUpdateInventory', () => {
  it('rejects an empty items array before any network call', async () => {
    await assert.rejects(() => bulkUpdateInventory(creds(), []), /items array is empty/);
    assert.equal(apiCalls.length, 0);
  });

  it('POSTs to the inventory feed endpoint', async () => {
    stub.apiBody = { feedId: 'feed-123' };
    const out = await bulkUpdateInventory(creds(), [
      { sku: 'SKU-1', quantity: 5 },
      { sku: 'SKU-2', quantity: 0 },
    ]);
    assert.equal(apiCalls[0].init.method, 'POST');
    assert.equal(
      apiCalls[0].url,
      'https://marketplace.walmartapis.com/v3/feeds?feedType=inventory',
    );
    assert.deepEqual(out, { feedId: 'feed-123' });
  });
});
