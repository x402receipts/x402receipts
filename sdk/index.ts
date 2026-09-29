/**
 * @x402receipts/sdk — records every x402 purchase an agent makes.
 *
 *   import { wrapFetchWithPayment } from "@x402/fetch";
 *   import { withRegister } from "@x402receipts/sdk";
 *
 *   const register = withRegister(fetch, { payWith: () => fetchWithPayment });
 *   const fetchWithPayment = wrapFetchWithPayment(register, wallet);
 *
 * Put withRegister INSIDE the payment wrapper (as above) and it sees the 402 challenge,
 * so every receipt carries the amount, the payee and the network. Put it outside and it
 * still records what was bought and whether it arrived; the amount is then filled in
 * later by reconciliation against the chain.
 *
 * Uploads are paid over x402 from the agent's own wallet: USD 0.01 the first time it records
 * on a given day, free for the rest of that day. Give the SDK the paying fetch and it settles
 * its own uploads (an apiKey only chooses the workspace):
 *
 *   const register = withRegister(fetch, { payWith: () => fetchWithPayment });
 *   const fetchWithPayment = wrapFetchWithPayment(register, wallet);
 *
 * It never throws and never delays the request: hashing happens locally, sending
 * happens in the background, and if x402receipts is unreachable the agent keeps working.
 */

export interface RegisterOptions {
  /** Optional: files receipts under this workspace instead of the paying wallet's own. Uploads are paid over x402 either way (see payWith). */
  apiKey?: string;
  /** Where your x402receipts runs. Defaults to the hosted service. */
  endpoint?: string;
  /**
   * A fetch that can answer 402 challenges — normally the result of wrapFetchWithPayment.
   * Used to upload receipts when there is no apiKey. Lazy, so it may refer to the wrapper
   * that wraps this very function.
   */
  payWith?: () => typeof fetch;
  /** Flush the queue this often (ms). */
  flushIntervalMs?: number;
  /** Largest number of receipts per flush. */
  batchSize?: number;
  /** Called on delivery problems. Default: silent. */
  onError?: (err: unknown) => void;
  /** Override for tests / unusual runtimes. */
  fetchForUpload?: typeof fetch;
  /**
   * Which agent this is, as an HCS-14 universal agent identifier (`uaid:aid:…` / `uaid:did:…`)
   * or a plain DID. Recorded on every receipt, so a wallet shared by several agents still
   * produces a register that says which one spent the money.
   */
  agent?: string;
}

export interface ReceiptPayload {
  id: string;
  occurredAt: string;
  network: string;
  payer?: string | null;
  payee?: string | null;
  amountAtomic?: string | null;
  asset?: string | null;
  txRef?: string | null;
  resource: string;
  method: string;
  requestHash: string;
  responseHash?: string | null;
  responseStatus?: number | null;
  delivered: boolean;
  /** HCS-14 universal agent identifier or DID, when the caller sets one. */
  agent?: string;
  /** The seller's own signed receipt (x402 offer-receipt extension), when the seller issues one. */
  sellerReceipt?: unknown;
}

interface Challenge { network: string; payTo: string | null; amountAtomic: string | null; asset: string | null; at: number }

const PAYMENT_HEADERS = ["payment-signature", "x-payment"];
const RESPONSE_HEADERS = ["payment-response", "x-payment-response"];

export function withRegister(fetchImpl: typeof fetch, opts: RegisterOptions = {}): typeof fetch {
  const endpoint = (opts.endpoint ?? "https://app.x402receipts.com").replace(/\/$/, "");
  const flushEvery = opts.flushIntervalMs ?? 2000;
  const batchSize = opts.batchSize ?? 200;
  const onError = opts.onError ?? (() => {});

  const queue: ReceiptPayload[] = [];
  let pass: string | null = null; // the day's pass, issued by the first paid upload; free uploads until the day ends, then the next one pays again
  const challenges = new Map<string, Challenge>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  function uploader(): typeof fetch {
    if (opts.fetchForUpload) return opts.fetchForUpload;
    if (opts.payWith) return opts.payWith();
    return fetch;
  }

  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, batchSize);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (pass) headers.authorization = `Bearer ${pass}`;
      else if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
      const res = await uploader()(`${endpoint}/api/v1/receipts`, { method: "POST", headers, body: JSON.stringify({ receipts: batch }) });
      if (!res.ok) { if (res.status === 401) pass = null; throw new Error(`x402receipts: upload failed with ${res.status}`); }
      try { const body = (await res.clone().json()) as { pass?: { token?: string } }; if (body?.pass?.token) pass = body.pass.token; } catch { /* keep the old pass */ }
    } catch (err) {
      queue.unshift(...batch); // try again next time
      onError(err);
    } finally {
      flushing = false;
      if (queue.length) schedule();
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; void flush(); }, flushEvery);
    // Don't keep a Node process alive just for us.
    (timer as { unref?: () => void }).unref?.();
  }

  function enqueue(r: ReceiptPayload) {
    queue.push(r);
    if (queue.length >= batchSize) void flush(); else schedule();
  }

  const wrapped: typeof fetch = async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Our own uploads (paid or not) are not the agent's purchases; don't record them.
    if (url.startsWith(endpoint + "/")) return fetchImpl(input, init);

    const key = `${method} ${url}`;
    const startedAt = new Date().toISOString();
    const paymentHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    const paying = hasHeader(paymentHeaders, PAYMENT_HEADERS);

    let requestHash = "";
    try { requestHash = await sha256(`${method}\n${url}\n${await bodyText(input, init)}`); } catch { /* keep going */ }

    const response = await fetchImpl(input, init);

    try {
      if (response.status === 402) {
        // Remember what this resource asked for; the paid retry comes next.
        const challenge = await parseChallenge(response.clone());
        if (challenge) challenges.set(key, challenge);
        return response;
      }
      if (!paying) return response;

      const challenge = challenges.get(key);
      challenges.delete(key);
      const settlement = parseSettlement(response.headers);
      let responseHash: string | null = null;
      try { responseHash = await sha256(await response.clone().text()); } catch { /* opaque body */ }

      enqueue({
        id: uuid(),
        ...(opts.agent ? { agent: opts.agent } : {}),
        occurredAt: startedAt,
        network: settlement?.network ?? challenge?.network ?? "unknown",
        payer: settlement?.payer ?? payerFromPayment(paymentHeaders) ?? null,
        payee: challenge?.payTo ?? null,
        amountAtomic: challenge?.amountAtomic ?? null,
        asset: challenge?.asset ?? null,
        txRef: settlement?.transaction ?? null,
        resource: url,
        method,
        requestHash,
        responseHash,
        responseStatus: response.status,
        delivered: response.ok,
        // a seller that speaks the offer-receipt extension signs its own receipt: evidence nobody can fake later
        sellerReceipt: settlement?.extensions?.["offer-receipt"]?.info?.receipt ?? null,
      });
    } catch (err) {
      onError(err);
    }
    return response;
  };

  return wrapped;
}

// ---- helpers ----------------------------------------------------------------

function hasHeader(h: HeadersInit | undefined, names: string[]): boolean {
  return getHeader(h, names) !== null;
}

function getHeader(h: HeadersInit | undefined, names: string[]): string | null {
  if (!h) return null;
  const headers = h instanceof Headers ? h : new Headers(h);
  for (const n of names) { const v = headers.get(n); if (v) return v; }
  return null;
}

async function bodyText(input: RequestInfo | URL, init?: RequestInit): Promise<string> {
  const b = init?.body;
  if (typeof b === "string") return b;
  if (b instanceof URLSearchParams) return b.toString();
  if (b && typeof (b as Blob).text === "function") return (b as Blob).text();
  if (input instanceof Request && input.body) return input.clone().text();
  return "";
}

async function parseChallenge(res: Response): Promise<Challenge | null> {
  try {
    const raw = res.headers.get("payment-required");
    const body = raw ? JSON.parse(atob(raw)) : await res.json();
    const accept = body?.accepts?.[0];
    if (!accept) return null;
    return {
      network: String(accept.network ?? "unknown"),
      payTo: accept.payTo ?? null,
      amountAtomic: accept.amount ?? accept.maxAmountRequired ?? null,
      asset: accept.asset ?? null,
      at: Date.now(),
    };
  } catch {
    return null;
  }
}

/** The agent's own address, read from the payment it just signed (EVM payloads carry it; Solana ones don't — the server fills it in from the upload's settlement). */
function payerFromPayment(headers: HeadersInit | undefined): string | null {
  const raw = getHeader(headers, PAYMENT_HEADERS);
  if (!raw) return null;
  try {
    const p = JSON.parse(atob(raw)) as { payload?: { authorization?: { from?: string }; permit2?: { owner?: string } } };
    return p.payload?.authorization?.from ?? p.payload?.permit2?.owner ?? null;
  } catch {
    return null;
  }
}

function parseSettlement(headers: Headers): { transaction?: string; network?: string; payer?: string; extensions?: Record<string, { info?: { receipt?: unknown } }> } | null {
  for (const name of RESPONSE_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    try { return JSON.parse(atob(raw)); } catch { /* not base64 json */ }
  }
  return null;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uuid(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}
