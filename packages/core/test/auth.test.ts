import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAccessToken, walmartFetch, WalmartError } from '../src/auth.js';
import {
  installRig,
  uninstallRig,
  tokenCalls,
  apiCalls,
  stub,
  freshClient,
  advanceTime,
} from './helpers.js';

beforeEach(installRig);
afterEach(uninstallRig);

describe('getAccessToken', () => {
  it('caches the token: a second call makes no second token request', async () => {
    const id = freshClient();
    const a = await getAccessToken(id, 'secret');
    const b = await getAccessToken(id, 'secret');
    assert.equal(a, b);
    assert.equal(tokenCalls.length, 1);
  });

  it('refreshes exactly once after the TTL expires', async () => {
    const id = freshClient();
    const a = await getAccessToken(id, 'secret');
    advanceTime(901_000); // past the 900s TTL
    const b = await getAccessToken(id, 'secret');
    const c = await getAccessToken(id, 'secret');
    assert.notEqual(a, b);
    assert.equal(b, c);
    assert.equal(tokenCalls.length, 2);
  });

  it('refreshes proactively when inside the 60s refresh buffer', async () => {
    stub.tokenExpiresIn = 61;
    const id = freshClient();
    const a = await getAccessToken(id, 'secret'); // expiresAt = now + 61s
    advanceTime(2_000); // 59s remain < 60s buffer
    const b = await getAccessToken(id, 'secret');
    assert.notEqual(a, b);
    assert.equal(tokenCalls.length, 2);
  });

  it('does not refresh when well within the TTL', async () => {
    const id = freshClient();
    await getAccessToken(id, 'secret');
    advanceTime(100_000); // 800s remain
    await getAccessToken(id, 'secret');
    assert.equal(tokenCalls.length, 1);
  });

  it('isolates the cache per clientId', async () => {
    const a = await getAccessToken(freshClient(), 's');
    const b = await getAccessToken(freshClient(), 's');
    assert.notEqual(a, b);
    assert.equal(tokenCalls.length, 2);
  });

  it('throws WalmartError carrying status and body when the token endpoint fails', async () => {
    stub.tokenStatus = 401;
    stub.tokenBody = 'invalid_client';
    await assert.rejects(() => getAccessToken(freshClient(), 'bad'), (e: unknown) => {
      assert.ok(e instanceof WalmartError);
      assert.equal(e.status, 401);
      assert.equal(e.body, 'invalid_client');
      return true;
    });
  });

  it('sends Basic auth and correlation headers to the token endpoint', async () => {
    const id = freshClient();
    await getAccessToken(id, 's3cr3t');
    assert.equal(tokenCalls.length, 1);
    const headers = tokenCalls[0].init.headers as Record<string, string>;
    assert.equal(
      headers['Authorization'],
      `Basic ${Buffer.from(`${id}:s3cr3t`).toString('base64')}`,
    );
    assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.ok(String(headers['WM_QOS.CORRELATION_ID']).startsWith('wm-mcp-'));
  });
});

describe('walmartFetch', () => {
  it('sends bearer + walmart headers', async () => {
    stub.apiBody = { sku: 'A', quantity: { unit: 'EACH', amount: 3 } };
    await walmartFetch(freshClient(), 's', 'GET', '/v3/inventory?sku=A');
    assert.equal(apiCalls.length, 1);
    const headers = apiCalls[0].init.headers as Record<string, string>;
    assert.ok(headers['Authorization']?.startsWith('Bearer tok-'));
    assert.equal(headers['WM_SEC.ACCESS_TOKEN'], headers['Authorization'].slice('Bearer '.length));
    assert.equal(headers['WM_SVC.NAME'], 'Walmart Marketplace');
    assert.ok(headers['WM_QOS.CORRELATION_ID']);
  });

  it('maps HTTP errors to WalmartError with method, path and status', async () => {
    stub.apiStatus = 400;
    stub.apiBody = '{"error":"bad sku"}';
    await assert.rejects(
      () => walmartFetch(freshClient(), 's', 'GET', '/v3/inventory?sku=BAD'),
      (e: unknown) => {
        assert.ok(e instanceof WalmartError);
        assert.equal(e.status, 400);
        assert.match(e.message, /GET \/v3\/inventory\?sku=BAD → 400/);
        return true;
      },
    );
  });

  it('returns undefined on 204', async () => {
    stub.apiStatus = 204;
    const out = await walmartFetch(freshClient(), 's', 'DELETE', '/v3/x');
    assert.equal(out, undefined);
  });
});
