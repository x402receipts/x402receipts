# x402receipts

**Accounting infrastructure for autonomous spending.** Every x402 purchase an agent makes becomes a receipt, reconciled against the on-chain transaction, with missing or unmatched payments flagged, monthly statements for finance, and evidence anyone can verify.

- Website: https://x402receipts.com · App: https://app.x402receipts.com · Live statement: https://app.x402receipts.com/demo
- Docs for agents: https://app.x402receipts.com/llms.txt · OpenAPI: https://app.x402receipts.com/openapi.json
- Price: **USD 1 per agent wallet per calendar month**, paid over x402 in USDC (Base, Solana) by the agent's own wallet. Unlimited receipts. No API key.

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

## In this repo

| Path | What |
|---|---|
| [`sdk/`](sdk) | the `x402receipts-sdk` npm package (single file, no dependencies) |
| [`packages/mcp/`](packages/mcp) | the `x402receipts-mcp` MCP server |
| [`examples/`](examples) | plain Node, Vercel AI SDK, LangChain, OpenAI Agents |
| [`integrations/agentkit/`](integrations/agentkit) | Coinbase AgentKit action provider |
| [`integrations/x402-ecosystem/`](integrations/x402-ecosystem) | x402.org ecosystem entry |

## How it works

1. **Capture** — the SDK records each paid call: resource, amount, counterparty, transaction reference, request/response fingerprints, delivery status, and the seller's signed receipt when it issues one (x402 `offer-receipt`).
2. **Reconcile** — the connected wallets are read on Base and Solana; every outgoing USDC payment is matched to a receipt. What doesn't match is an exception, not an average.
3. **Prove** — each night, each account's receipts form a group; the group's Merkle root is written to the Hedera Consensus Service with a link to the group page. Every receipt has a public verification page that redoes the maths in the browser.
4. **Report** — the owner signs in with the wallet: spend by supplier, the register, CSV and signed JSON export.

Guide: https://x402receipts.com/guide.html · Status: https://app.x402receipts.com/status · Contact: hello@x402receipts.com

MIT licensed.
