# Walmart Marketplace MCP

A **source-level v0.1.0** Model Context Protocol server for Walmart Marketplace seller operations. The current source exposes three tool families: **items, inventory and orders**. It uses MCP **stdio transport** and Walmart seller API credentials supplied to the running process.

**Status:** This repository's source and private workspace packages do not establish a public SaaS endpoint, a published ChatGPT plugin, Walmart partner certification, a hosted login service, or authorization for unrelated seller accounts. Confirm API access and legal scope with Walmart before operating it.

## Source layout

- `packages/mcp/src/index.ts`: stdio MCP entrypoint and tool dispatcher
- `packages/core/`: shared Walmart API client and types
- `packages/mcp/`: MCP tool definitions and server package

## Local developer verification

Requirements from the project manifests: Node.js **20 or later**, pnpm **9.12.0** and separately authorized Walmart Marketplace API credentials.

```sh
pnpm install
pnpm build
pnpm test
pnpm mcp:stdio
```

The stdio entrypoint expects the `WALMART_CLIENT_ID` and `WALMART_CLIENT_SECRET` **environment variable names** to be set by the authorized operator. Never hard-code credentials into a repository, issue, shell history screenshot, sample configuration or agent conversation. A successful MCP initialize does not verify a seller account or an API mutation.

**Support:** [Troubleshooting and reporting](SUPPORT.md) | [Public GitHub Issues](https://github.com/jabbertones-cloud/walmart-marketplace-mcp/issues).

## Privacy and operations

Provider responses, order IDs, buyer addresses, financial records and OAuth secrets can be sensitive. Use the least privileged seller authorization, keep logging redacted, and distinguish successful tool discovery from an authenticated Walmart response and confirmed provider after-state. This repository is not the CommerceOS private Walmart account, and source availability does not grant rights to any other seller's data.

Reviewed November 17, 2026 against `main` commit `8ec1283172886d8e99b337d599f3448785287e9d`. Documentation does not attest a deployment.
