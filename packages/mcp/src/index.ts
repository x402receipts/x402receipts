#!/usr/bin/env node
/**
 * x402receipts MCP server — three tools an agent (or the person running it) can call:
 *   x402receipts_service_info      price, networks, docs; nothing is paid
 *   x402receipts_record_receipts   record purchases as receipts; USD 1 per wallet per calendar month over x402 from a configured wallet, then free
 *   x402receipts_verify_receipt    public verification material for one receipt (hash, Merkle path, ledger entry)
 *
 * Wallet for paying (optional; without it record_receipts explains what's needed):
 *   X402RECEIPTS_EVM_PRIVATE_KEY     0x… secp256k1 key holding USDC on Base
 *   X402RECEIPTS_SOLANA_PRIVATE_KEY  hex (32 or 64 bytes) or base58 ed25519 key holding USDC on Solana
 *   X402RECEIPTS_ENDPOINT            default https://app.x402receipts.com
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { ExactSvmScheme } from "@x402/svm";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes, createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";

const ENDPOINT = (process.env.X402RECEIPTS_ENDPOINT ?? "https://app.x402receipts.com").replace(/\/$/, "");
const BASE = "eip155:8453";
const SOLANA = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

const receiptShape = {
  id: z.string().min(8).max(128).describe("Unique id for the receipt (uuid recommended)"),
  occurredAt: z.string().describe("ISO 8601 time of the purchase"),
  network: z.string().describe("CAIP-2 network the purchase was paid on, e.g. eip155:8453"),
  resource: z.string().describe("URL that was bought"),
  method: z.string().default("GET"),
  requestHash: z.string().regex(/^[0-9a-f]{64}$/i).describe("sha256 hex of method + url + body"),
  delivered: z.boolean().describe("Whether the purchase returned a successful response"),
  payer: z.string().optional(), payee: z.string().optional(),
  amountAtomic: z.string().optional().describe("Amount in the asset's smallest unit, e.g. 4000 = 0.004 USDC"),
  asset: z.string().optional().describe("Asset address, e.g. USDC on Base 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  txRef: z.string().optional().describe("Settlement transaction hash/signature"),
  responseHash: z.string().optional(), responseStatus: z.number().int().optional(),
  sellerReceipt: z.any().optional().describe("The seller's signed x402 offer-receipt, if it issued one"),
};

async function payingFetch(): Promise<{ fetch: typeof fetch; wallets: string[] } | null> {
  const schemes: { network: `${string}:${string}`; client: ExactEvmScheme | ExactSvmScheme }[] = [];
  const wallets: string[] = [];
  const evm = process.env.X402RECEIPTS_EVM_PRIVATE_KEY;
  if (evm && /^0x[0-9a-fA-F]{64}$/.test(evm)) {
    const account = privateKeyToAccount(evm as `0x${string}`);
    schemes.push({ network: BASE, client: new ExactEvmScheme(account) });
    wallets.push(`${account.address} (Base)`);
  }
  const sol = process.env.X402RECEIPTS_SOLANA_PRIVATE_KEY;
  if (sol) {
    const bytes = decodeKey(sol);
    const signer = bytes.length === 64 ? await createKeyPairSignerFromBytes(bytes) : await createKeyPairSignerFromPrivateKeyBytes(bytes);
    schemes.push({ network: SOLANA, client: new ExactSvmScheme(signer) });
    wallets.push(`${signer.address} (Solana)`);
  }
  if (!schemes.length) return null;
  return { fetch: wrapFetchWithPaymentFromConfig(fetch, { schemes }), wallets };
}

function decodeKey(s: string): Uint8Array {
  const hex = s.replace(/^0x/, "");
  if (/^[0-9a-fA-F]+$/.test(hex) && (hex.length === 64 || hex.length === 128)) return Uint8Array.from(Buffer.from(hex, "hex"));
  if (s.trim().startsWith("[")) return Uint8Array.from(JSON.parse(s) as number[]);
  return base58(s);
}
function base58(s: string): Uint8Array {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes: number[] = [0];
  for (const ch of s) {
    let carry = A.indexOf(ch);
    if (carry < 0) throw new Error("bad base58");
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (const ch of s) { if (ch !== "1") break; bytes.push(0); }
  return Uint8Array.from(bytes.reverse());
}

async function challenge(): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${ENDPOINT}/api/v1/receipts`);
  const h = r.headers.get("payment-required");
  if (!h) return null;
  try { return JSON.parse(Buffer.from(h, "base64").toString("utf8")); } catch { return null; }
}

const server = new McpServer({ name: "x402receipts", version: "1.0.0" });

server.registerTool("x402receipts_service_info", {
  title: "x402receipts: service info",
  description: "What x402receipts is (accounting and reconciliation for autonomous x402 spending), what it costs (USD 1 per wallet per calendar month, paid by the agent's wallet in USDC on Base or Solana; unlimited receipts) and where the docs are. Pays nothing.",
  inputSchema: {},
}, async () => {
  const c = await challenge();
  const accepts = ((c?.accepts as { network: string; amount: string; payTo: string; asset: string }[]) ?? []).map((a) => ({ network: a.network, amountAtomicPerReceipt: a.amount, payTo: a.payTo, asset: a.asset }));
  const info = { service: "x402receipts", endpoint: `${ENDPOINT}/api/v1/receipts`, pricePerWalletPerMonthUsd: 1, accepts, docs: `${ENDPOINT}/llms.txt`, openapi: `${ENDPOINT}/openapi.json`, verify: `${ENDPOINT}/verify/{receiptId}`, signIn: `${ENDPOINT}/login`, note: "The wallet that pays becomes the account. Its owner signs in with the same wallet to see statements; other agent wallets can be connected with one signature each." };
  return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
});

server.registerTool("x402receipts_record_receipts", {
  title: "x402receipts: record receipts",
  description: "Record 1–500 x402 purchases as receipts. Costs USD 1 per wallet per calendar month over x402 (first upload of the month pays; the rest are free), from the wallet configured in X402RECEIPTS_EVM_PRIVATE_KEY (Base) or X402RECEIPTS_SOLANA_PRIVATE_KEY (Solana). Returns the settlement and the workspace the receipts were filed under.",
  inputSchema: { receipts: z.array(z.object(receiptShape)).min(1).max(500), payWith: z.enum(["base", "solana"]).optional().describe("Which configured wallet pays; default: the first configured") },
}, async ({ receipts, payWith }) => {
  const p = await payingFetch();
  if (!p) {
    const c = await challenge();
    return { isError: true, content: [{ type: "text", text: `No paying wallet configured. Set X402RECEIPTS_EVM_PRIVATE_KEY (USDC on Base) or X402RECEIPTS_SOLANA_PRIVATE_KEY (USDC on Solana) in the MCP server's environment. The endpoint asks for: ${JSON.stringify(c?.accepts ?? [])}` }] };
  }
  const body = JSON.stringify({ receipts });
  const res = await p.fetch(`${ENDPOINT}/api/v1/receipts`, { method: "POST", headers: { "content-type": "application/json" }, body });
  const json = await res.json().catch(() => null);
  const pr = res.headers.get("payment-response");
  const settlement = pr ? JSON.parse(Buffer.from(pr, "base64").toString("utf8")) : null;
  const out = { status: res.status, paidWith: payWith ?? p.wallets[0], result: json, settlement: settlement ? { success: settlement.success, transaction: settlement.transaction, network: settlement.network, payer: settlement.payer } : null };
  return { isError: !res.ok, content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
});

server.registerTool("x402receipts_verify_receipt", {
  title: "x402receipts: verify a receipt",
  description: "Public verification material for one receipt: its canonical fields and hash, the Merkle path to the batch root, and the Hedera ledger entry that holds the root (with explorer links). Anyone with the receipt id can call this; nothing is paid.",
  inputSchema: { id: z.string().describe("The receipt id") },
}, async ({ id }) => {
  const res = await fetch(`${ENDPOINT}/api/v1/receipts/${encodeURIComponent(id)}/verify`);
  const text = await res.text();
  return { isError: !res.ok, content: [{ type: "text", text }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
