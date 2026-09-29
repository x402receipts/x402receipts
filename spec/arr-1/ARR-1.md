# Agent Receipt Record — ARR-1

*An open format for verifiable records of what autonomous agents buy.*

**Version** 1.1 · **Status** draft · **Published** 28 September 2026 · **Updated** 29 September 2026 · **Editor** x402receipts · **Licence** CC0 1.0

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

**Receipt** — the record of one purchase. **Core** — the subset of its fields that is hashed. **Fingerprint** — the sha256 of the canonical core. **Log** — one account's receipts, in the order they were accepted, appended to and never rewritten. **Batch** — the receipts added to the log since the previous checkpoint, typically one account-day. **Tree** — the Merkle tree over the log. **Root** — the head of that tree. **Checkpoint** — a root together with the log size it covers. **Anchor** — the message carrying a checkpoint, written to a public ledger. **Inclusion proof** — the path from one fingerprint to a root. **Consistency proof** — the hashes showing that one root is contained unchanged in a later one. **Issuer** — the party that keeps the log, checkpoints it and anchors it.

The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as in RFC 2119.

## 4. The receipt

An agent submits a receipt per purchase. The submission form is defined by <a href="receipt.schema.json">`receipt.schema.json`</a>; required fields are `id`, `occurredAt`, `network`, `resource`, `method`, `requestHash` and `delivered`.

Two rules matter more than the rest:

- **Amounts are strings, never JSON numbers.** `"0.004"`, not `0.004`. Floating point cannot represent decimal amounts exactly, and a fingerprint computed over a float is not reproducible.
- **Content is hashed, not stored.** `requestHash` is the sha256 of `method + "\n" + url + "\n" + body`; `responseHash` the sha256 of the response body. An issuer MUST NOT require the content itself. This keeps what the agent bought private while still allowing a later dispute to be settled: re-hash the content, compare.

An issuer MAY accept `amountAtomic` + `asset` instead of `amount` + `currency`, and MUST normalise them to human units before hashing. An issuer MUST treat a repeated `id` as the same record and MUST NOT create a duplicate.

<h3 id="s4-1">4.1 Who paid, and which agent</h3>

`network` is a [CAIP-2](https://chainagnostic.org/CAIPs/caip-2) chain identifier (`eip155:8453`, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`). Together with `payer` or `payee` it forms a [CAIP-10](https://chainagnostic.org/CAIPs/caip-10) account identifier, which is how a reader names the wallet outside this document.

A wallet is not an agent. One wallet often funds several agents, and an agent may be rebuilt, renamed or moved between wallets while remaining the same thing to the finance team. A receipt MAY therefore carry `agent`: an [HCS-14](https://github.com/hiero-ledger/hiero-consensus-specifications/blob/main/docs/standards/hcs-14/index.md) universal agent identifier (`uaid:aid:…` for a deterministic identifier derived from the agent's own metadata, `uaid:did:…` for one that already holds a DID), or a plain DID. HCS-14 names agents the same way across registries and protocols, which is exactly what a ledger of agent spending needs; ARR-1 does not define an identifier of its own.

`agent` is the one core field that is **omitted rather than set to `null`** when absent. This keeps the fingerprint of a record that names no agent identical to what it was before this field existed. When present it is part of the fingerprint, so the claim "this agent made this purchase" is covered by the anchor like everything else in the core.

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

## 6. The log, the tree and the root

The receipts of one account form an **append-only log**. A receipt is given a position in that log when it is accepted, and that position never changes: records are added at the end, never inserted, reordered or removed. Everything below is a statement about the log, which is what lets a reader check that yesterday's evidence is still standing inside today's.

The tree over the log is the Merkle Tree Hash of [RFC 9162 §2.1](https://www.rfc-editor.org/rfc/rfc9162#section-2.1) — the tree Certificate Transparency has used in production for a decade — over the receipt fingerprints as raw 32-byte values, in log order:

- the hash of an empty log is `sha256("")`;
- the hash of a single fingerprint `d` is `sha256(0x00 ‖ d)`;
- for `n > 1` leaves, let `k` be the largest power of two smaller than `n`; the hash is `sha256(0x01 ‖ MTH(leaves[0:k]) ‖ MTH(leaves[k:n]))`.

The two prefix bytes are the point of the profile: a leaf is hashed behind `0x00` and an internal node behind `0x01`, so no value can be read as both, and no one can pass an internal node off as a receipt. The split at the largest power of two, rather than duplicating an odd node, means a tree of `n` leaves is a prefix of every larger tree — which is what makes consistency provable.

A **checkpoint** is the tree head over *every* receipt in the log so far, together with its size. An issuer SHOULD publish a checkpoint once per account per day. A checkpoint MUST cover the whole log and not only the receipts added since the last one: covering only the new ones would make each root an island, and an issuer could quietly drop an older record without contradicting anything it had published. An issuer MAY state, alongside the checkpoint, how many receipts were added since the previous one and the time span they cover.

Worked example — a log whose first two fingerprints are `57829beaf…45112` and `05fc3e26d…0b45b` (§5) has leaves

```
leaf 0  37a27e6c179009a96fe9a37d72f25f9751e5469c19adda1ba3be4c45971650a4
leaf 1  125030ad95878c7f7ef21da3a57a75d6012e0874a71127c47dae702f06d027b7
```

and, at size 2, the root

```
hex        e4995b4c82880c97512d1b0c13359add10c85d4fc29a2d9896a1819a792a8dea
base64url  5JlbTIKIDJdRLRsMEzWa3RDIXU_Cmi2YlqGBmnkqjeo
```

The same log at size 1 had root `37a27e…50a4`, and `["125030ad95878c7f7ef21da3a57a75d6012e0874a71127c47dae702f06d027b7"]` is the RFC 9162 consistency proof between the two: the reader can check that the smaller tree is contained, unchanged, in the larger one.

Anchoring the log rather than the day is what makes the cost of evidence independent of volume: one message covers one receipt or ten thousand, and it covers every receipt that came before.

> **Records anchored before this profile.** Version 1.0 hashed leaves without prefixes and paired an odd node with itself. Roots published that way remain valid and remain verifiable; a proof over them is labelled `"merkle": "arr1-v1"` and a verifier MUST fold it with the 1.0 rule. New roots MUST use `"merkle": "rfc9162"`. Fingerprints (§5) are unchanged by this revision — only the tree above them.

## 7. The anchor record

A checkpoint is published to the ledger as an [HCS-27](https://github.com/hiero-ledger/hiero-consensus-specifications/blob/main/docs/standards/hcs-27/index.md) message. HCS-27 is the Hiero standard for publishing Merkle checkpoints of an append-only log to the Hedera Consensus Service; it fixes the envelope, the tree profile and the linkage between consecutive checkpoints, and explicitly leaves the schema of the log's entries to whoever is logging. ARR-1 is that schema. The two fit together without either inventing the other's half, so ARR-1 defines no anchoring mechanism of its own.

The message MUST be submitted in the canonical form of §5 and MUST fit in one 1 KB ledger message. It carries the root, the size, the previous checkpoint and where the batch can be read — and nothing about what was bought, from whom, or for how much.

```
{"metadata":{"arr":{"added":2,"batch":"86a240c0-64d9-49f1-aea3-e4d32faf620b","from":"2026-09-24T10:04:11.000Z","spec":"https://x402receipts.com/spec/arr-1","to":"2026-09-24T23:12:40.000Z","url":"https://app.x402receipts.com/batch/86a240c0-64d9-49f1-aea3-e4d32faf620b"},"log":{"alg":"sha-256","leaf":"sha256(jcs(receipt-core))","merkle":"rfc9162"},"prev":{"rootHashB64u":"N6J-bBeQCalv6aN9cvJfl1HlRpwZrdobo75MRZcWUKQ","treeSize":"1"},"root":{"rootHashB64u":"5JlbTIKIDJdRLRsMEzWa3RDIXU_Cmi2YlqGBmnkqjeo","treeSize":"2"},"stream":{"log_id":"27f6d763-804b-47cc-b429-f8502d3995ea","registry":"x402receipts"},"type":"arr-1-checkpoint-v1"},"op":"register","p":"hcs-27"}
```

- `p` / `op` — the HCS-27 envelope.
- `metadata.type` — what kind of record this is, in the issuer's own namespace: `arr-1-checkpoint-v1`.
- `metadata.stream` — which log this is: the registry that keeps it and the opaque account identifier.
- `metadata.log` — how a leaf is produced: sha256 of the canonicalised receipt core (§5), folded with the RFC 9162 tree (§6).
- `metadata.root` — the tree head: size, and root as base64url of the 32 raw bytes.
- `metadata.prev` — the previous checkpoint of the same log, same shape. Absent on the first one. This is the chain a reader walks to check nothing was dropped between two days.
- `metadata.arr` — the ARR-1 part: which receipts were added, over what span, and the page where they can be read.

The example above is 661 bytes. An issuer whose identifiers or URLs would push the message past 1 KB MUST shorten them rather than drop `prev` or `root`.

A period statement (§10.1) is published in the same envelope shape under its own protocol tag, since it is a document fingerprint rather than a tree head:

```
{"metadata":{"final":false,"period":"2026-09","receipts":59,"spec":"https://x402receipts.com/spec/arr-1","statement":"35a53c63e4cbb447256f7961479b273744d29260d7ae93fea6f39532b4496256","stream":{"log_id":"9254677d-3973-4d60-b510-475c3a4cc0b9","registry":"x402receipts"},"type":"arr-1-statement-v1","unmatched":1,"url":"https://app.x402receipts.com/statement/9254677d-3973-4d60-b510-475c3a4cc0b9/2026-09"},"op":"statement","p":"arr-1"}
```

The ledger MUST be public, append-only, and MUST timestamp entries independently of the issuer. The reference implementation uses the [Hedera Consensus Service](https://hedera.com/consensus-service), where a write costs USD 0.0008 at a price fixed in dollars; any ledger with equivalent properties conforms, and an issuer anchoring elsewhere SHOULD keep the same message body. An issuer SHOULD anchor within 24 hours of a receipt being accepted and MUST publish the ledger coordinates (network, topic or equivalent) so that anchors can be read without the issuer's cooperation.

## 8. The proof

A proof bundle (<a href="proof.schema.json">`proof.schema.json`</a>) carries the receipt core, its fingerprint, the path from that fingerprint to a published root, and the ledger coordinates of the message carrying that root. A path entry is `{ "hash", "position" }`, where `position` says whether the sibling goes on the left or the right when the pair is hashed. The bundle MUST name the tree profile in `proof.merkle` (`"rfc9162"` or `"arr1-v1"`) and SHOULD carry `leafIndex` and `treeSize`, which are what let a reader reproduce the path independently.

An issuer MUST make a proof available for every anchored receipt, to anyone holding the receipt identifier, without authentication. Receipt identifiers are unguessable; the link is the access.

An issuer SHOULD also serve a **consistency proof** between any two published tree sizes of the same log, as the list of hashes defined in RFC 9162 §2.1.4. An inclusion proof shows a receipt is in one tree; a consistency proof shows that tree was never rewritten afterwards. A register that offers only the first can still quietly drop a record between two days.

## 9. Verification

Given a proof bundle, a verifier MUST:

1. rebuild the core from the bundle, canonicalise it (§5) and compute its sha256; it MUST equal the stated fingerprint;
2. compute the leaf, `sha256(0x00 ‖ fingerprint)`, and fold it up the path — for each entry, `acc = sha256(0x01 ‖ sibling ‖ acc)` when the sibling is on the left, `sha256(0x01 ‖ acc ‖ sibling)` when on the right — and the result MUST equal the stated root. Where the bundle says `"merkle": "arr1-v1"`, the 1.0 rule applies instead: no prefixes, `acc = sha256(sibling ‖ acc)` or `sha256(acc ‖ sibling)`;
3. read the anchor record from the ledger directly, at the stated coordinates, and check that the root it carries — `metadata.root.rootHashB64u`, base64url of the same 32 bytes — equals the root, and that its consensus timestamp is not later than the moment the verifier first saw the record.

Step 3 MUST NOT be performed through the issuer. A verification that reads the ledger through the issuer's API proves nothing that the issuer could not fabricate.

A verifier that is checking a register over time SHOULD also walk `metadata.prev` from the newest checkpoint backwards and verify each consistency proof, which establishes that every earlier root is still contained in the current one. This is the check that catches deletion, and it is the reason §6 anchors the whole log rather than the day.

All three checks passing establish that this receipt existed, in exactly this form, at the anchor's consensus time. They establish nothing about whether the goods were worth the money, and nothing about receipts that were never submitted — which is what §10 is for.

## 10. Completeness

Integrity says the records are unaltered. Completeness says there are no missing ones. An ARR-1 issuer claiming completeness MUST, for each wallet and period:

- read the outgoing payments of that wallet from the chain itself, not from the agent's account of them;
- match each payment to a receipt — by settlement reference where present, otherwise by counterparty, amount and time within a stated window;
- state the unmatched ones. A payment with no receipt is a finding, not noise: it usually means an agent running without instrumentation, or a transfer that was not a purchase.

An issuer SHOULD read from at least two independent sources (for example an indexer and a node), because a single indexer can silently skip a block. The period statement SHOULD carry, per wallet: the number of payments seen on-chain, the number matched, the unmatched list with their settlement references, and the sources and heights used.

<h3 id="s10-1">10.1 The period statement</h3>

An issuer claiming Level 3 SHOULD publish the claim as a document. A **period statement** (<a href="/spec/arr-1/statement.schema.json">`statement.schema.json`</a>) covers one account and one period and carries: the period and whether it is `final` (the period had ended when it was produced); totals spent; how many receipts, delivered, anchored and supplier-signed; **per wallet**, how many payments were seen on-chain, how many matched, and the unmatched ones with their settlement references; every batch of the period with its root and ledger coordinates; and the data sources consulted.

The statement is canonicalised and hashed as in §5, and the hash is anchored as a record of type `arr-1-statement-v1` (§7).

A `final` statement MUST NOT be replaced: a correction is a new statement for a later period, not a rewrite of a closed one. An interim statement (produced before the period ended) MAY be superseded. Verification is §9 applied to the document: canonicalise, hash, compare with the anchored fingerprint, read that fingerprint from the ledger directly. A live example: [a September statement](https://app.x402receipts.com/statement/9254677d-3973-4d60-b510-475c3a4cc0b9/2026-09) and [its anchor](https://hashscan.io/mainnet/transaction/1790594552.120220104).

The distinction between *funding* and *expense* belongs here. A transfer into an agent's wallet is funding; it is not a purchase and MUST NOT be recorded as one. The expenses are the outgoing payments to suppliers.

## 11. Supplier-signed receipts

Everything above is evidence produced on the buyer's side. The strongest form of evidence comes from the counterparty. Where a supplier implements the x402 `offer-receipt` extension, its signed receipt travels in the `PAYMENT-RESPONSE` header; an ARR-1 issuer SHOULD capture it, verify the signature, record the recovered signer, and carry both alongside the record. A receipt whose signature does not verify MUST be stored without a signer rather than silently dropped or silently trusted.

A supplier signature is what turns "our system says we bought this" into "the supplier says it sold it to us". Suppliers that sign are doing their customers' finance teams a favour at a cost of roughly ten lines of code.

## 12. Conformance

- **Level 1 — Recorded.** Receipts in ARR-1 form, fingerprinted as in §5, retrievable by id.
- **Level 2 — Anchored.** Level 1, plus batches anchored as in §6–7 and proofs available to third parties as in §8.
- **Level 3 — Reconciled.** Level 2, plus completeness as in §10: on-chain reconciliation per wallet and period, with unmatched payments stated.

An implementation MUST state the level it claims and the ledger it anchors to, and MUST name the tree profile of every root it publishes. Anchoring on the Hedera Consensus Service, a Level 2 implementation MUST publish checkpoints as HCS-27 messages (§7).

An implementation MUST NOT claim a level it cannot demonstrate on request: for Level 2, a proof bundle and a ledger message a stranger can read; for Level 3, a period statement naming its on-chain sources. The reference implementation operates at Level 3.

## 13. Reference implementation

[x402receipts](https://x402receipts.com) implements ARR-1 at Level 3 and runs the registry. Source: [github.com/x402receipts/x402receipts](https://github.com/x402receipts/x402receipts) (MIT).

- Submit receipts: `POST https://app.x402receipts.com/api/v1/receipts` (paid over x402)
- Proof bundle for one receipt, public: `GET https://app.x402receipts.com/api/v1/receipts/{id}/verify`
- Human verification page, which redoes §9 in the reader's browser: `https://app.x402receipts.com/verify/{id}`
- Batch page named in every anchor record: `https://app.x402receipts.com/batch/{id}`
- Client library: `npm i x402receipts-sdk` · MCP server: `npx -y x402receipts-mcp`

Anchors are written to Hedera mainnet, topic `0.0.10889260`, readable by anyone through any Hedera mirror node.

## 14. Status, licence and versioning

Version 1.1, published 29 September 2026 (1.0: 28 September 2026). This is a draft: the schemas and the algorithms in §§5–9 are stable and the reference implementation follows them, but the text may still be clarified.

**What changed in 1.1.** The tree of §6 became the RFC 9162 profile and the anchor record of §7 became an HCS-27 message, so that ARR-1 uses an existing anchoring standard instead of a parallel one; checkpoints now cover the whole log, which makes consistency provable. Receipt fingerprints are unchanged, and roots published under 1.0 stay verifiable under the `arr1-v1` label. §4.1 adopts CAIP-2/CAIP-10 for accounts and HCS-14 for the optional agent identifier.

The specification and its schemas are released into the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Implement it, fork it, embed it in another standard; no permission and no attribution required.

A change that alters a fingerprint requires a new record version, carried in the `v` field of the core. A change that alters a root or an anchor record requires a new label in `merkle` and in the anchor's `metadata.log`, so that records published under the older rule stay verifiable rather than becoming unreadable. Comments and corrections: [hello@x402receipts.com](mailto:hello@x402receipts.com) or an issue on the repository.
