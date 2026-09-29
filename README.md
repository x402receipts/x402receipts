# x402receipts

**Accounting infrastructure for autonomous spending.** Every x402 purchase an agent makes becomes a receipt, reconciled against the on-chain transaction, with missing or unmatched payments flagged, monthly statements for finance, and evidence anyone can verify.

- Website: https://x402receipts.com · App: https://app.x402receipts.com · Live statement: https://app.x402receipts.com/demo
- Docs for agents: https://app.x402receipts.com/llms.txt · OpenAPI: https://app.x402receipts.com/openapi.json
- Price: **USD 0.01 per agent wallet for each day it records purchases**, paid over x402 in USDC (Base, Solana) by the agent's own wallet. A quiet day costs nothing, so a month never exceeds USD 0.31. Unlimited receipts. No API key.

## Use it

**In code — one wrapper around the fetch your agent already pays with** (`npm i x402receipts-sdk`):

```ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { withRegister } from "x402receipts-sdk";

const register = withRegister(fetch, { endpoint: "https://app.x402receipts.com", payWith: () => pay });
const pay = wrapFetchWithPayment(register, wallet);
```

**As an MCP server** (`npx -y x402receipts-mcp`): `record_receipts`, `verify_receipt`, `service_info`. See [`packages/mcp`](packages/mcp).

**Over HTTP**: `POST https://app.x402receipts.com/api/v1/receipts` — answers 402 with the x402 challenge; any x402 client pays it.

**With an AI coding tool**: paste [the integration prompt](https://x402receipts.com/#prompt) into Claude Code or Cursor.

## The format is an open standard

The record, its fingerprint, the append-only log above it, the anchor record and the verification algorithm are published as **[ARR-1 — Agent Receipt Record](spec/arr-1/ARR-1.md)**, released into the public domain (CC0). JSON Schemas are in [`spec/arr-1/`](spec/arr-1). Implement it yourself, or check our implementation against it.

ARR-1 builds on existing standards rather than replacing them: the tree is the RFC 9162 profile used by Certificate Transparency, checkpoints are published as [HCS-27](https://github.com/hiero-ledger/hiero-consensus-specifications/blob/main/docs/standards/hcs-27/index.md) messages, accounts are named with CAIP-2/CAIP-10, and agents with [HCS-14](https://github.com/hiero-ledger/hiero-consensus-specifications/blob/main/docs/standards/hcs-14/index.md) identifiers.

## In this repo

| Path | What |
|---|---|
| [`spec/arr-1/`](spec/arr-1) | the ARR-1 specification and its JSON Schemas (CC0) |
| [`sdk/`](sdk) | the `x402receipts-sdk` npm package (single file, no dependencies) |
| [`packages/mcp/`](packages/mcp) | the `x402receipts-mcp` MCP server |
| [`examples/`](examples) | plain Node, Vercel AI SDK, LangChain, OpenAI Agents |
| [`integrations/agentkit/`](integrations/agentkit) | Coinbase AgentKit action provider |
| [`integrations/x402-ecosystem/`](integrations/x402-ecosystem) | x402.org ecosystem entry |

## How it works

1. **Capture** — the SDK records each paid call: resource, amount, counterparty, transaction reference, request/response fingerprints, delivery status, and the seller's signed receipt when it issues one (x402 `offer-receipt`).
2. **Reconcile** — the connected wallets are read on Base and Solana; every outgoing USDC payment is matched to a receipt. What doesn't match is an exception, not an average.
3. **Prove** — each night, the account's whole receipt log is hashed into one RFC 9162 Merkle tree and its root is written to the Hedera Consensus Service, linked to the previous day's root. Every receipt has a public verification page that redoes the maths in the browser.
4. **Report** — the owner signs in with the wallet: spend by supplier, the register, CSV and signed JSON export.

Guide: https://x402receipts.com/guide.html · Status: https://app.x402receipts.com/status · Contact: hello@x402receipts.com

MIT licensed.
