import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe('stdio MCP protocol', () => {
  it('lists tools and rejects unknown names without credentials', async () => {
    const child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, WALMART_CLIENT_ID: '', WALMART_CLIENT_SECRET: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { output += chunk; });
    try {
      const request = (id: number, method: string, params: object = {}) =>
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      const waitFor = async (id: number): Promise<any> => {
        const until = Date.now() + 4000;
        while (Date.now() < until) {
          const message = output.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return {}; } }).find(msg => msg.id === id);
          if (message) return message;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error(`MCP response ${id} timeout: ${output}`);
      };
      request(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'stdio-test', version: '1' } });
      assert.ok((await waitFor(1)).result);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      request(2, 'tools/list');
      const listed = await waitFor(2);
      assert.ok(listed.result.tools.length > 0);
      request(3, 'tools/call', { name: 'walmart_unknown_test', arguments: {} });
      const unknown = await waitFor(3);
      assert.equal(unknown.result.isError, true);
      assert.match(unknown.result.content[0].text, /Unknown tool: walmart_unknown_test/);
    } finally {
      child.kill();
    }
  });
});
