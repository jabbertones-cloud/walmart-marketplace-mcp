// Walmart Marketplace API — OAuth2 Client Credentials token management.
// Token TTL: 900s. Refresh when < 60s remaining.

export const BASE_URL = 'https://marketplace.walmartapis.com';
const TOKEN_URL = `${BASE_URL}/v3/token`;
const REFRESH_BUFFER_MS = 60_000;

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, TokenCache>();

export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const hit = cache.get(clientId);
  if (hit && hit.expiresAt - Date.now() > REFRESH_BUFFER_MS) return hit.accessToken;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': cid(),
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new WalmartError(`Token fetch failed ${res.status}`, res.status, body);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  const entry: TokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  cache.set(clientId, entry);
  return entry.accessToken;
}

export function cid(): string {
  return `wm-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class WalmartError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'WalmartError';
  }
}

export async function walmartFetch<T>(
  clientId: string,
  clientSecret: string,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const token = await getAccessToken(clientId, clientSecret);
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'WM_SEC.ACCESS_TOKEN': token,
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': cid(),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return undefined as unknown as T;

  if (!res.ok) {
    const text = await res.text();
    throw new WalmartError(`${method} ${path} → ${res.status}`, res.status, text);
  }

  return res.json() as Promise<T>;
}

/**
 * Submit a feed payload as multipart/form-data with filename="feed.json".
 * Walmart's feed parser switches format (JSON vs XML) by the file extension in
 * the Content-Disposition filename — sending plain application/json causes
 * itemsReceived: 0 because it defaults to XML mode.
 */
export async function walmartFeedPost<T>(
  clientId: string,
  clientSecret: string,
  path: string,
  payload: unknown,
): Promise<T> {
  const token = await getAccessToken(clientId, clientSecret);
  const boundary = `----WalmartBoundary${Date.now()}`;
  const crlf = '\r\n';
  const jsonBytes = Buffer.from(JSON.stringify(payload));
  const multipart = Buffer.concat([
    Buffer.from(
      `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="file"; filename="feed.json"${crlf}` +
        `Content-Type: application/json${crlf}` +
        crlf,
    ),
    jsonBytes,
    Buffer.from(`${crlf}--${boundary}--${crlf}`),
  ]);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'WM_SEC.ACCESS_TOKEN': token,
      'WM_SVC.NAME': 'Walmart Marketplace',
      'WM_QOS.CORRELATION_ID': cid(),
      Accept: 'application/json',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipart,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new WalmartError(`POST ${path} → ${res.status}`, res.status, text);
  }

  return res.json() as Promise<T>;
}
