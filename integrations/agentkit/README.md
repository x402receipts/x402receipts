# Contributing x402receipts to Coinbase AgentKit

Files in `x402receipts/` follow the layout of `typescript/agentkit/src/action-providers/x402/` in https://github.com/coinbase/agentkit.

Steps (needs a GitHub account):
1. Fork https://github.com/coinbase/agentkit, clone, `cd typescript/agentkit && npm install`.
2. Copy this `x402receipts/` folder to `typescript/agentkit/src/action-providers/x402receipts/`.
3. Add `export * from "./x402receipts";` to `typescript/agentkit/src/action-providers/index.ts`.
4. Add a changelog entry: `npx changeset` → "Add x402receipts action provider (record and verify x402 receipts)".
5. `npm run lint && npm test -- x402receipts && npm run build`.
6. Open a PR: "feat(action-providers): add x402receipts (reconciled, auditable receipts for x402 spending)".
