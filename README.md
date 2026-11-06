# Last Call

**AI jobs at last call.** Spare AI compute is wiped every night at midnight UTC. Last Call turns it into private AI jobs anyone can buy, cheaper every second until the reset.

Built at ETHGlobal Mumbai (Nov 5 to 7, 2026).

- **Providers** run a small worker with their own 0G key. It lists today's services (translate, summarize, transcribe) on Arkiv, with a price that falls toward the 00:00 UTC reset, and does paid jobs on 0G.
- **Buyers** pick the cheapest offer, seal their job on their own phone to that provider, and pay in USDT with no wallet and no gas.
- **Nobody in the middle can read it.** Our server and Arkiv only ever hold ciphertext. Jobs run on 0G's private-enclave models, and every result carries the 0G request ID as a receipt.

## How a job flows

```
 buyer's phone                         Arkiv (rabdi testnet)                provider's machine
 ─────────────                         ─────────────────────                ──────────────────
 reads Listing (price falls to reset)  ◄── Listing: service, model, ────── worker lists today's
                                           boxKey, start/floor price,       services (expires 00:00 UTC)
 seals job to provider's boxKey            expires at 00:00 UTC
 signs USDT permit + order (no gas)
   └─► server /api/relay/job
         ├─ checks order vs live Listing
         ├─ Bazaar.buy() on Whitechain ─► USDT to provider (99%) + fee (1%)
         └─ writes Job (ciphertext) ──────► Job ───────────────────────────► worker opens job,
                                                                              runs it on 0G (TeeML),
 opens the sealed result  ◄──────────────── Result: output sealed ◄──────── seals result to buyer
   with its own reply key                   to buyer + 0G request ID
```

## Proof it runs

| What | Where |
|---|---|
| Checkout contract (verified) | [`0x9f8Df40996313fa4c4A562480eC59bba2BC24a90`](https://explorer.testnet.whitechain.io/address/0x9f8Df40996313fa4c4A562480eC59bba2BC24a90) on Whitechain Sepolia (1874) |
| A paid job, settled in test USDT | [`0xd194c1a4…c8c9`](https://explorer.testnet.whitechain.io/tx/0xd194c1a4918f68593597671ec923b086b7a74ee0b663eee5bbd05b574227c8c9) |
| That job's 0G inference request ID | `d375a5c18dfa9461` (`glm-5.3`, TeeML) |
| Relayer, writer of `Job` entities | `0xDe74bc008F4898aFBf9Db2A94363511D250d5275` |
| Demo provider worker, writer of `Listing` and `Result` entities | `0xbBBcEc068b958C8002d52F954c1aE77c3b25B678` |
| Arkiv network | rabdi testnet, chain ID 7794095 |

### An Arkiv query you can run

```js
import { createPublicClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { http } from "viem"
import { Listing } from "./shared/schemas.mjs"

const client = createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http() })
const { entities } = await client.select().from(Listing).where(eq("market", "ethglobal-mumbai")).fetch()
// every live offer, with the columns to compute its current price (shared/pricing.mjs)
```

## Why each sponsor is load-bearing

- **Arkiv:** a listing lives exactly as long as the allowance it sells work from: it expires at 00:00 UTC, so tomorrow's market starts empty with no cleanup job. Jobs and results are entities only their two parties can open, and any app or agent can query the cheapest live offer without asking us.
- **0G:** every job is 0G inference on the provider's own key, on TeeML (enclave) models where available, with the request ID stored in the result. Remove 0G and there is nothing to sell.
- **Whitechain:** the buyer pays in USDT and never sees gas, a seed phrase or a chain. The relayer pays gas; the buyer signed seller, price and buyer, so it can't redirect or inflate a payment.
- **World ID:** one human, one welcome balance. It stops a bot farm draining the free USDT and the relayer's gas.

## What is and isn't private

- **Our server, Arkiv, other providers and the public:** see only ciphertext and receipts.
- **0G's machines:** enclave models run in a TEE with zero retention.
- **The provider you pay:** reads your job, like any freelancer reads what you send them. Offers say which model runs and whether it's an enclave model.

## Fair use of 0G allowance

iAI's terms say the daily compute allowance can't be exchanged for cash or transferred separately from the token. Providers on Last Call don't sell allowance; they sell finished work they did with their own compute.

## Run it

Node 22+ and pnpm.

```bash
git clone https://github.com/AllenAJ/AI-marketplace.git && cd AI-marketplace
pnpm install && (cd web && pnpm install)
cp .env.example .env    # fill in keys, see comments in the file
```

```bash
pnpm worker    # a provider: lists today's services, runs paid jobs on 0G
pnpm server    # relayer + World ID on :8788
cd web && npx vite --host --port 5210   # the buyer app
pnpm e2e       # one paid job end to end from the command line
```

`web/.env.local` needs `VITE_ARKIV_ACCESS_KEY`. Rehearsal helper: `pnpm dev:fund <wallet> [usdt]`.

## Current limitations

- The buyer's keys live in browser storage. Clearing it loses that phone's unread results and test USDT.
- World ID runs in the staging environment with the simulator for the hackathon.
- 0G's private Whisper provider was down during the event, so Transcribe uses `qwen3.5-omni-flash` and is labelled "Standard", not enclave.
- The Arkiv access key is in the web bundle; on testnet it only buys rate limit.
- The 1% fee doesn't cover gas at real prices; the plan is a 10% take rate with prepaid balances settled in batches.

## How we used AI

Built with Claude Code (Anthropic) as a pair programmer: it read the sponsor docs, wrote most of the code, and ran the end-to-end checks on testnet. Product decisions and the demo are ours. Branding and mascot art come from our earlier project Dogi.

## License

MIT
