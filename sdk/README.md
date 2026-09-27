# x402receipts

Accounting infrastructure for autonomous spending. This package records every x402 purchase an agent makes as a receipt and reports it to [x402receipts](https://x402receipts.com), where it is reconciled against the on-chain transaction, anchored with verifiable evidence and shown to finance as a monthly statement.

There is no API key. The agent pays USD 1 per calendar month, in USDC on Base or Solana, from the wallet it already buys with — with its first upload of the month; every upload after that is free. That wallet is the account. The owner signs in with the same wallet.

```ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { withRegister } from "x402receipts";

const register = withRegister(fetch, { endpoint: "https://app.x402receipts.com", payWith: () => pay });
const pay = wrapFetchWithPayment(register, wallet);

// use `pay` exactly as before: every paid call is recorded in the background
```

`withRegister` never throws and never delays a request. If x402receipts is unreachable the agent keeps buying; the wallet is read on-chain and reconciled later.

Docs: https://app.x402receipts.com/llms.txt · OpenAPI: https://app.x402receipts.com/openapi.json · Verify a receipt: https://app.x402receipts.com/verify/{id}
