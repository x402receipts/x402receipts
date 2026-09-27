import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { withRegister } from "x402receipts-sdk";

const wallet = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);

// 1. record every paid call (the only x402receipts line)
const register = withRegister(fetch, { endpoint: "https://app.x402receipts.com", payWith: () => pay });
// 2. pay over x402 with the agent's wallet, exactly as before
const pay = wrapFetchWithPaymentFromConfig(register, { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(wallet) }] });

// 3. buy something — this call is paid, recorded, and later reconciled against the chain
const res = await pay("https://api.onesource.io/api/chain/block-number?chain=base");
console.log(await res.json());
