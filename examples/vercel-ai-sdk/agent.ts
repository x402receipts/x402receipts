import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { withRegister } from "x402receipts";

const wallet = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const register = withRegister(fetch, { endpoint: "https://app.x402receipts.com", payWith: () => pay });
const pay = wrapFetchWithPaymentFromConfig(register, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(wallet) }] });

const { text } = await generateText({
  model: openai("gpt-5"),
  prompt: "What is the latest Base block number? Use the paid API.",
  tools: {
    baseBlockNumber: tool({
      description: "Latest Base block number (paid x402 API, ~$0.001)",
      inputSchema: z.object({}),
      execute: async () => (await pay("https://api.onesource.io/api/chain/block-number?chain=base")).json(),
    }),
  },
});
console.log(text);
