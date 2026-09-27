import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { withRegister } from "x402receipts-sdk";

const wallet = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const register = withRegister(fetch, { endpoint: "https://app.x402receipts.com", payWith: () => pay });
const pay = wrapFetchWithPaymentFromConfig(register, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(wallet) }] });

const baseBlockNumber = tool(
  async () => JSON.stringify(await (await pay("https://api.onesource.io/api/chain/block-number?chain=base")).json()),
  { name: "base_block_number", description: "Latest Base block number (paid x402 API, ~$0.001)", schema: z.object({}) },
);

const agent = createReactAgent({ llm: new ChatOpenAI({ model: "gpt-5" }), tools: [baseBlockNumber] });
const out = await agent.invoke({ messages: [{ role: "user", content: "What is the latest Base block number?" }] });
console.log(out.messages.at(-1)?.content);
