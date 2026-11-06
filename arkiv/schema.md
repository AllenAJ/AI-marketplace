# Arkiv schema

Defined once in [`shared/schemas.mjs`](../shared/schemas.mjs) and used unchanged by the provider worker, the relayer, the buyer's phone app and the scripts. Network: rabdi testnet (chain ID 7794095). Every entity carries `market` (today `ethglobal-mumbai`), so one deployment can run many markets side by side.

## `lc.listing`: a provider's offer for today

| Column | Type | Indexed | Why |
|---|---|---|---|
| `market` | str | yes | Every view starts with "offers in this market" |
| `provider` | addr | yes | A provider's own offers; also where USDT payouts go |
| `service` | str | yes | `translate`, `summarize` or `transcribe`: the buyer picks a service first |
| `model` | str | yes | The 0G model the provider promises to run |
| `privacy` | str | yes | `TeeML` (enclave) or `standard`: a filter for buyers who need enclave-only |
| `startPrice` | dec | no | Price when the listing opens |
| `floorPrice` | dec | no | Price at the reset |
| `opensAt` | u64 | no | Unix seconds |
| `resetsAt` | u64 | no | Unix seconds: the next 00:00 UTC |
| `capacity` | i32 | no | Jobs the provider will take today (the relayer enforces it) |
| `boxKey` | str | no | Provider's X25519 public key: buyers seal jobs to it |
| `title` | str | no | Display |

- **Owner and creator:** the provider's own key (the worker signs `createEntity`). Only they can change or delete it.
- **Expires:** `ExpirationTime.atDate(resetsAt)`, so at the next 00:00 UTC, the moment the provider's 0G allowance resets. The current price is a pure function of these columns ([`shared/pricing.mjs`](../shared/pricing.mjs)), so no one has to update the entity as the price falls.

## `lc.job`: one paid job, sealed

| Column | Type | Indexed | Why |
|---|---|---|---|
| `market` | str | yes | Market-wide activity |
| `listingKey` | key | yes | Which offer was bought; the relayer counts these against `capacity` |
| `provider` | addr | yes | The worker's inbox: "jobs addressed to me" |
| `buyer` | addr | yes | A buyer's own jobs |
| `service` | str | yes | Which service to run |
| `price` | dec | no | What was paid |
| `input` | bytes | no | The job, sealed on the buyer's phone to `listing.boxKey`. Ciphertext only |
| `replyKey` | str | no | Buyer's X25519 public key: the result is sealed to it |
| `whitechainTx` | str | no | The settled USDT payment, so anyone can check it was paid |

- **Owner and creator:** the relayer (`0xDe74bc008F4898aFBf9Db2A94363511D250d5275`), which writes it only after `Bazaar.buy` succeeds on Whitechain. It never sees the plaintext.
- **Expires:** 1 day. Long enough for the worker to pick it up and the buyer to fetch the result.

## `lc.result`: the finished work, sealed to the buyer

| Column | Type | Indexed | Why |
|---|---|---|---|
| `market` | str | yes | Market-wide activity |
| `jobKey` | key | yes | The buyer's phone polls "the result for my job" |
| `provider` | addr | yes | A provider's track record |
| `buyer` | addr | yes | A buyer's results |
| `model` | str | no | The model that actually ran |
| `zgRequestId` | str | no | 0G's request ID: the receipt that the job really ran on 0G |
| `output` | bytes | no | The answer, sealed to the job's `replyKey`. Ciphertext only |

- **Owner and creator:** the provider's key, so a result is signed by the provider who was paid.
- **Expires:** 1 day.

## Live numbers (Nov 6, 2026)

3 listings, 4 jobs and 4 results live in `ethglobal-mumbai`. A filtered query by market returns in 330 to 440 ms; a `createEntity` lands in about 7 seconds.
