import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { withRegister } from "x402receipts";

const wallet = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const register = withRegister(fetch, { endpoint: "https://app.x402receipts.com", payWith: () => pay });
const pay = wrapFetchWithPaymentFromConfig(register, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(wallet) }] });

const baseBlockNumber = tool({
  name: "base_block_number",
  description: "Latest Base block number (paid x402 API, ~$0.001)",
  parameters: z.object({}),
  execute: async () => (await pay("https://api.onesource.io/api/chain/block-number?chain=base")).json(),
});

const agent = new Agent({ name: "Researcher", instructions: "Use the paid API when asked about Base.", tools: [baseBlockNumber] });
const result = await run(agent, "What is the latest Base block number?");
console.log(result.finalOutput);
