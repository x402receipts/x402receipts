# Agent Receipt Record — ARR-1

*An open format for verifiable records of what autonomous agents buy.*

**Version** 1.0 · **Status** draft · **Published** 28 September 2026 · **Editor** x402receipts · **Licence** CC0 1.0

Canonical URL: https://x402receipts.com/spec/arr-1 · Schemas in this directory.

## 1. What this is

ARR-1 defines a record of a single purchase made by an autonomous software agent, and the way a set of such records is fingerprinted and anchored on a public ledger, so that a third party — an auditor, a counterparty, a finance team — can establish two things without trusting whoever produced them:

- **Integrity.** The record has not been altered since it was anchored, and the anchoring time is certified by a network the issuer does not control.
- **Completeness.** For a given wallet and period, the records account for every payment that actually left that wallet on-chain — and where they do not, the gap is stated.

The second property is the reason this specification exists. Integrity alone is what a signed log gives you, and a signed log remains a document the audited party wrote about itself. Completeness can only be established against a source the audited party does not control. For payments made over [x402](https://x402.org), that source is the chain the payment settled on.

## 2. What this is not

- **Not an invoice** or any other fiscal document. The supplier issues that. An ARR-1 record evidences that a payment happened, for what resource, and whether it was delivered.
- **Not a compliance certificate.** No record format makes anyone compliant with anything. This one is designed to be usable *as evidence* by someone who has to demonstrate compliance.
- **Not bound to one vendor, chain or ledger.** The receipt format is transport-agnostic; the anchoring section works with any append-only public log that provides third-party timestamps and can hold 1 KB messages.

## 3. Terms

**Receipt** — the record of one purchase. **Core** — the subset of its fields that is hashed. **Fingerprint** — the sha256 of the canonical core. **Batch** — a set of receipts fingerprinted together, typically one account-day. **Root** — the Merkle root of a batch. **Anchor** — the message carrying a root, written to a public ledger. **Proof** — the path from one fingerprint to its root. **Issuer** — the party that keeps the records, batches them and anchors them.

The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as in RFC 2119.

## 4. The receipt

An agent submits a receipt per purchase. The submission form is defined by <a href="receipt.schema.json">`receipt.schema.json`</a>; required fields are `id`, `occurredAt`, `network`, `resource`, `method`, `requestHash` and `delivered`.

Two rules matter more than the rest:

- **Amounts are strings, never JSON numbers.** `"0.004"`, not `0.004`. Floating point cannot represent decimal amounts exactly, and a fingerprint computed over a float is not reproducible.
- **Content is hashed, not stored.** `requestHash` is the sha256 of `method + "\n" + url + "\n" + body`; `responseHash` the sha256 of the response body. An issuer MUST NOT require the content itself. This keeps what the agent bought private while still allowing a later dispute to be settled: re-hash the content, compare.

An issuer MAY accept `amountAtomic` + `asset` instead of `amount` + `currency`, and MUST normalise them to human units before hashing. An issuer MUST treat a repeated `id` as the same record and MUST NOT create a duplicate.

## 5. Canonical form and fingerprint

The hashed object is defined by <a href="receipt-core.schema.json">`receipt-core.schema.json`</a>: the core fields, all present, with `null` where a value is absent, plus `v: 1` and the issuer's opaque `workspaceId`. Fields carried alongside the record but excluded from the fingerprint: the supplier's signed receipt, labels, and any issuer-specific metadata.

The canonical form is JSON with:

- object keys sorted by Unicode code point, at every level;
- no insignificant whitespace;
- properties whose value is `undefined` omitted (`null` is kept);
- strings escaped as in JSON.stringify; integers serialised without exponent or fraction.

For the field types ARR-1 uses — strings, booleans, one small integer, and `null` — this is byte-identical to [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785). Implementations MAY use an RFC 8785 library.

The fingerprint is `sha256(canonical(core))`, lower-case hex. Worked example — this canonical string:

```
{"amount":"0.004","currency":"USDC","delivered":true,"id":"b0f2b1a4-9e1c-4c7a-8a5e-2f6d4c3b1a09","method":"POST","network":"eip155:8453","occurredAt":"2026-09-24T10:04:11.000Z","payee":"0x52E29e0d2Aa49bfBfC548C0A9F2196F4aa51f3ea","payer":"0x63100a3a5A2F593eCD3c7CB49d366b8Cb79E423d","requestHash":"3f786850e387550fdab836ed7e6dc881de23001b4d4e9d1b2c0f4dbc9c0e2b2a","resource":"https://api.exa.ai/search","responseHash":"89e6c98d92887913cadf06b2adb97f26cde4849b1f9b2e5b4a8f2b6c3d1e0f77","responseStatus":200,"txRef":"0x16115c795c202b55b08eb951a2fc220d3a3e110a363a44dc4ab2d14022b8b029","v":1,"workspaceId":"27f6d763-804b-47cc-b429-f8502d3995ea"}
```

has the fingerprint
```
57829beafbd3352836d5c0cfa3cfce95c2501cf273b429da42c712a532a45112
```

## 6. Batches and the root

Receipts are grouped into batches. A batch SHOULD cover one account and one day; an issuer MAY choose another period, and MUST state which.

The leaves are the fingerprints of the batch's receipts, as raw 32-byte values, in the batch's stated order. A parent is `sha256(left ‖ right)` over the concatenated bytes. A level with an odd number of nodes pairs the last node with itself. The root of an empty batch is `sha256("")`; an issuer SHOULD NOT anchor empty batches.

Worked example — a two-receipt batch whose fingerprints are `57829beafbd3352836d5c0cfa3cfce95c2501cf273b429da42c712a532a45112` and `05fc3e26d3d4c3e2aa8fc823260a6e1c6956e160eeb3d32dccf48c554270b45b` has the root
```
150ad3ba12362b65432fe14c62d58ef27f3b3f1c67a6b69f691e168e87993b17
```

Batching is what makes the cost of evidence independent of volume: one anchor covers one receipt or ten thousand.

## 7. The anchor record

The message written to the ledger is defined by <a href="anchor.schema.json">`anchor.schema.json`</a> and MUST be submitted in the canonical form of §5. It carries the root, the size and the period — and nothing about what was bought, from whom, or for how much.

```
{"app":"x402receipts","batch":"86a240c0-64d9-49f1-aea3-e4d32faf620b","count":2,"from":"2026-09-24T10:04:11.000Z","root":"150ad3ba12362b65432fe14c62d58ef27f3b3f1c67a6b69f691e168e87993b17","to":"2026-09-24T23:12:40.000Z","url":"https://app.x402receipts.com/batch/86a240c0-64d9-49f1-aea3-e4d32faf620b","v":1,"workspace":"27f6d763-804b-47cc-b429-f8502d3995ea"}
```

The ledger MUST be public, append-only, and MUST timestamp entries independently of the issuer. The reference implementation uses the [Hedera Consensus Service](https://hedera.com/consensus-service), where a write costs USD 0.0008 at a price fixed in dollars; any ledger with equivalent properties conforms. An issuer SHOULD anchor within 24 hours of a receipt being accepted and MUST publish the ledger coordinates (network, topic or equivalent) so that anchors can be read without the issuer's cooperation.

## 8. The proof

A proof bundle (<a href="proof.schema.json">`proof.schema.json`</a>) carries the receipt core, its fingerprint, the path to the root and the ledger coordinates. A path entry is `{ "hash", "position" }`, where `position` says whether the sibling goes on the left or the right when the pair is hashed.

An issuer MUST make a proof available for every anchored receipt, to anyone holding the receipt identifier, without authentication. Receipt identifiers are unguessable; the link is the access.

## 9. Verification

Given a proof bundle, a verifier MUST:

- rebuild the core from the bundle, canonicalise it (§5) and compute its sha256; it MUST equal the stated fingerprint;
- fold the fingerprint up the path — for each entry, `acc = sha256(sibling ‖ acc)` when the sibling is on the left, `sha256(acc ‖ sibling)` when on the right — and the result MUST equal the stated root;
- read the anchor record from the ledger directly, at the stated coordinates, and check that its `root` equals the root, and that its consensus timestamp is not later than the moment the verifier first saw the record.

Step 3 MUST NOT be performed through the issuer. A verification that reads the ledger through the issuer's API proves nothing that the issuer could not fabricate.

All three checks passing establish that this receipt existed, in exactly this form, at the anchor's consensus time. They establish nothing about whether the goods were worth the money, and nothing about receipts that were never submitted — which is what §10 is for.

## 10. Completeness

Integrity says the records are unaltered. Completeness says there are no missing ones. An ARR-1 issuer claiming completeness MUST, for each wallet and period:

- read the outgoing payments of that wallet from the chain itself, not from the agent's account of them;
- match each payment to a receipt — by settlement reference where present, otherwise by counterparty, amount and time within a stated window;
- state the unmatched ones. A payment with no receipt is a finding, not noise: it usually means an agent running without instrumentation, or a transfer that was not a purchase.

An issuer SHOULD read from at least two independent sources (for example an indexer and a node), because a single indexer can silently skip a block. The period statement SHOULD carry, per wallet: the number of payments seen on-chain, the number matched, the unmatched list with their settlement references, and the sources and heights used.

The distinction between *funding* and *expense* belongs here. A transfer into an agent's wallet is funding; it is not a purchase and MUST NOT be recorded as one. The expenses are the outgoing payments to suppliers.

## 11. Supplier-signed receipts

Everything above is evidence produced on the buyer's side. The strongest form of evidence comes from the counterparty. Where a supplier implements the x402 `offer-receipt` extension, its signed receipt travels in the `PAYMENT-RESPONSE` header; an ARR-1 issuer SHOULD capture it, verify the signature, record the recovered signer, and carry both alongside the record. A receipt whose signature does not verify MUST be stored without a signer rather than silently dropped or silently trusted.

A supplier signature is what turns "our system says we bought this" into "the supplier says it sold it to us". Suppliers that sign are doing their customers' finance teams a favour at a cost of roughly ten lines of code.

## 12. Conformance

- **Level 1 — Recorded.** Receipts in ARR-1 form, fingerprinted as in §5, retrievable by id.
- **Level 2 — Anchored.** Level 1, plus batches anchored as in §6–7 and proofs available to third parties as in §8.
- **Level 3 — Reconciled.** Level 2, plus completeness as in §10: on-chain reconciliation per wallet and period, with unmatched payments stated.

An implementation MUST state the level it claims and the ledger it anchors to. The reference implementation operates at Level 3.

## 13. Reference implementation

[x402receipts](https://x402receipts.com) implements ARR-1 at Level 3 and runs the registry. Source: [github.com/x402receipts/x402receipts](https://github.com/x402receipts/x402receipts) (MIT).

- Submit receipts: `POST https://app.x402receipts.com/api/v1/receipts` (paid over x402)
- Proof bundle for one receipt, public: `GET https://app.x402receipts.com/api/v1/receipts/{id}/verify`
- Human verification page, which redoes §9 in the reader's browser: `https://app.x402receipts.com/verify/{id}`
- Batch page named in every anchor record: `https://app.x402receipts.com/batch/{id}`
- Client library: `npm i x402receipts-sdk` · MCP server: `npx -y x402receipts-mcp`

Anchors are written to Hedera mainnet, topic `0.0.10889260`, readable by anyone through any Hedera mirror node.

## 14. Status, licence and versioning

Version 1.0, published 28 September 2026. This is a draft: the schemas and the algorithms in §§5–9 are stable and the reference implementation follows them, but the text may still be clarified.

The specification and its schemas are released into the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Implement it, fork it, embed it in another standard; no permission and no attribution required.

A change that alters a fingerprint, a root or an anchor record for the same inputs requires a new version number, carried in the `v` field. Comments and corrections: [hello@x402receipts.com](mailto:hello@x402receipts.com) or an issue on the repository.
