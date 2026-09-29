# x402receipts-mcp

An MCP server that gives any agent (Claude Desktop, Claude Code, Cursor, or your own) three tools from [x402receipts](https://x402receipts.com) — accounting and reconciliation for autonomous spending:

| Tool | What it does | Pays |
|---|---|---|
| `x402receipts_service_info` | Price, networks, docs | nothing |
| `x402receipts_record_receipts` | Record 1–500 x402 purchases as receipts | USD 0.01 per wallet for each day it records, from the configured wallet; free for the rest of that day |
| `x402receipts_verify_receipt` | Public verification material for a receipt (hash, Merkle path, Hedera ledger entry) | nothing |

## Run

```json
{
  "mcpServers": {
    "x402receipts": {
      "command": "npx",
      "args": ["-y", "x402receipts-mcp"],
      "env": { "X402RECEIPTS_EVM_PRIVATE_KEY": "0x…" }
    }
  }
}
```

`X402RECEIPTS_EVM_PRIVATE_KEY` (USDC on Base) and/or `X402RECEIPTS_SOLANA_PRIVATE_KEY` (USDC on Solana) are optional: without them the server still answers `service_info` and `verify_receipt`, and `record_receipts` explains what is needed. The wallet that pays becomes the account; its owner signs in at https://app.x402receipts.com with the same wallet.

Docs: https://app.x402receipts.com/llms.txt · OpenAPI: https://app.x402receipts.com/openapi.json
