# Walmart Marketplace MCP support

**Reviewed:** November 17, 2026

This is a source-level MCP server with a stdio entrypoint and three seller operation families: items, inventory and orders. It is not a verified hosted app or a customer-self-service Walmart account connection.

## Troubleshoot locally

| Symptom | What to check |
| --- | --- |
| MCP client does not see tools | Confirm Node.js 20+, installed pnpm dependencies, built workspace modules and that your client starts the stdio entrypoint in `packages/mcp/src/index.ts` |
| Server says Walmart credentials are missing | Check the two documented **environment variable names** in the [README](README.md); never submit their values to support |
| Walmart API request is rejected | Confirm your own authorized seller app, approved scopes, region and provider response status. Redact credentials and buyer/order details |
| Tool name is unknown | Check the discovered tool list; the source server dispatches item, inventory and order tool families only |
| Tool call succeeds but Seller Center looks unchanged | Collect an authenticated provider read-back. A local MCP return value is not automatically a confirmed listing, inventory or order state |

## Reporting an issue

Use [GitHub Issues](https://github.com/jabbertones-cloud/walmart-marketplace-mcp/issues) for **public, reproducible source defects**. Include the source commit/version, OS and Node version, MCP host, redacted command, expected and observed results, plus the safe error label. Do not share real API keys, refresh tokens, private Walmart seller information, buyer PII, order bodies, or raw provider logs.

For a vulnerability, use a private security reporting method if enabled rather than publishing exploit details. Access to GitHub issue writing uses **your own GitHub authorization**; agents should obtain consent before filing and verify a successful write.

**Availability boundary:** No public hosted MCP, published plugin, multi-tenant external-seller OAuth or independent production deployment is confirmed by this source audit. GitHub Actions were not enabled or used for these documentation changes.
