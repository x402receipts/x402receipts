# Examples — keeping receipts for x402 agent payments

Each example is the smallest possible agent that pays over x402 and records every purchase on [x402receipts](https://x402receipts.com). The only x402receipts-specific line in every example is `withRegister(...)`.

| Folder | Stack |
|---|---|
| `node/` | plain Node 20+, `@x402/fetch` |
| `vercel-ai-sdk/` | Vercel AI SDK tool calling |
| `langchain/` | LangChain.js tool |
| `openai-agents/` | OpenAI Agents SDK tool |

Setup for all of them:

```bash
npm install x402receipts-sdk @x402/fetch @x402/evm viem
export AGENT_PRIVATE_KEY=0x…   # a wallet holding USDC on Base
```

The wallet pays the seller for each purchase and pays x402receipts USD 0.01 on each day it records; every upload after that is free until the day ends. Sign in at https://app.x402receipts.com with the same wallet to see the statement.
