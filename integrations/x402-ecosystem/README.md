# Listing on x402.org/ecosystem

The ecosystem page is generated from `typescript/site/app/ecosystem/partners-data/<slug>/metadata.json`
in https://github.com/coinbase/x402, with logos under `typescript/site/public/logos/`.

To submit (needs a GitHub account):

1. Fork https://github.com/coinbase/x402 and clone the fork.
2. Copy `partners-data/x402receipts/metadata.json` to `typescript/site/app/ecosystem/partners-data/x402receipts/metadata.json`.
3. Copy `logos/x402receipts.png` to `typescript/site/public/logos/x402receipts.png`.
4. Commit on a branch `ecosystem/x402receipts`, push, open a PR titled
   `ecosystem: add x402receipts (Infrastructure & Tooling)` with the body below.

PR body:

> Adds x402receipts to the ecosystem page under Infrastructure & Tooling.
> x402receipts records every x402 purchase an agent makes as a receipt, reconciles it against the settled on-chain transaction (Base, Solana), flags missing or unmatched payments, and gives finance teams monthly statements, exports and independently verifiable evidence. It is itself an x402 resource (paid per receipt, listed in the Bazaar): https://app.x402receipts.com/api/v1/receipts — docs at https://app.x402receipts.com/llms.txt, OpenAPI at https://app.x402receipts.com/openapi.json.
