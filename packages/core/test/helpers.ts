// Shared offline test rig: stubs global fetch (token endpoint + API) and
// Date.now. No network is ever touched by these tests.

export interface FetchCall {
  url: string;
  init: RequestInit;
}

export interface StubSpec {
  tokenStatus?: number;
  tokenBody?: unknown;
  tokenExpiresIn?: number; // seconds; default 900
  apiStatus?: number;
  apiBody?: unknown;
}

export const tokenCalls: FetchCall[] = [];
export const apiCalls: FetchCall[] = [];
export const stub: StubSpec = {};

const realFetch = globalThis.fetch;
const realNow = Date.now;
let nowMs = 1_700_000_000_000;
let tokenSeq = 0;
let clientSeq = 0;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function freshClient(): string {
  clientSeq += 1;
  return `test-client-${clientSeq}`;
}

export function advanceTime(ms: number): void {
  nowMs += ms;
}

export function installRig(): void {
  nowMs = 1_700_000_000_000;
  tokenSeq = 0;
  tokenCalls.length = 0;
  apiCalls.length = 0;
  stub.tokenStatus = undefined;
  stub.tokenBody = undefined;
  stub.tokenExpiresIn = undefined;
  stub.apiStatus = undefined;
  stub.apiBody = undefined;
  Date.now = () => nowMs;
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    url: unknown,
    init: unknown,
  ): Promise<Response> => {
    const u = String(url);
    const rec = { url: u, init: init as RequestInit };
    if (u.endsWith('/v3/token')) {
      tokenCalls.push(rec);
      if ((stub.tokenStatus ?? 200) !== 200) {
        return new Response(String(stub.tokenBody ?? 'token_error'), {
          status: stub.tokenStatus,
        });
      }
      tokenSeq += 1;
      return jsonResponse({
        access_token: `tok-${tokenSeq}`,
        expires_in: stub.tokenExpiresIn ?? 900,
      });
    }
    apiCalls.push(rec);
    const status = stub.apiStatus ?? 200;
    if (status === 204) return new Response(null, { status: 204 });
    if (status !== 200) {
      return new Response(String(stub.apiBody ?? 'api_error'), { status });
    }
    return jsonResponse(stub.apiBody ?? {});
  };
}

export function uninstallRig(): void {
  Date.now = realNow;
  globalThis.fetch = realFetch;
}
