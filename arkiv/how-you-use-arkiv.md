# How we use Arkiv

## Do the things we filter on, who can edit each entity, and when it expires fit what the app does?

**Filters match the questions each party asks.**

| Who | Question | Query |
|---|---|---|
| Buyer's phone | What can I buy right now, and from whom? | `Listing` where `market` = X (then cheapest per `service` by live price) |
| Buyer's phone | Is my answer back? | `Result` where `jobKey` = my job |
| Provider's worker | Have I listed today? | `Listing` where `market` = X and `provider` = me |
| Provider's worker | Any paid jobs for me? | `Job` where `market` = X and `provider` = me |
| Provider's worker | Did I already answer this one? | `Result` where `jobKey` = this job |
| Relayer | Is this provider fully booked? | `Job` where `listingKey` = this listing, counted against `capacity` |

Every column we filter on is indexed; everything else (prices, keys, ciphertext) is stored but not indexed, so we don't pay for indexes we never use.

**Ownership follows who is accountable.**

- A `Listing` is owned by the provider who will do the work. Nobody else, including us, can edit or delete their offer.
- A `Result` is owned by the provider, so the answer is signed by the provider who got paid.
- A `Job` is owned by the relayer, because it writes the job only after the payment settles on Whitechain: the job's existence is our attestation that it was paid. Trade-off: the relayer could delete a job. A next step is `changeOwnership` to the buyer once the result lands.

**Expiry is the product.**

- `Listing`: `ExpirationTime.atDate(next 00:00 UTC)`. The offer dies at the exact moment the provider's 0G allowance resets, so the market can never sell work from allowance that no longer exists, and tomorrow starts empty without a cleanup job.
- `Job` and `Result`: 1 day. Enough to deliver; after that, sealed data a buyer has already read doesn't linger anywhere.

## Does each Arkiv feature we use change something users see?

| Arkiv feature | What the user sees |
|---|---|
| Expiry at a date (`atDate`) | The countdown to midnight UTC on the home screen; offers vanish at reset |
| Indexed `service` + `privacy` | Three service cards, each with its cheapest offer and a "Private enclave" or "Standard" badge |
| Indexed `listingKey` (count) | "Fully booked" when a provider hits today's capacity |
| Indexed `jobKey` | "Paid ✓, a provider is on it…" turning into the answer in about 10 seconds |
| `bytes` columns | The sealed job and answer: the app shows "We, Arkiv and everyone else see only ciphertext" and it's true |
| Owner = provider | Results are signed by the provider who was paid; the receipt shows the model and 0G request ID |
| Public, permissionless reads | The phone reads Arkiv directly. Our server isn't in the read path at all |

## A query you can run

```js
import { createPublicClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { and, eq } from "@arkiv-network/sdk/query"
import { http } from "viem"
import { Listing } from "../shared/schemas.mjs"

const client = createPublicClient({ chain: rabdi({ accessKey: "" }), transport: http() })
const { entities } = await client
  .select({ $key: true, $expiresAt: true, provider: true, model: true, startPrice: true, floorPrice: true, resetsAt: true })
  .from(Listing)
  .where(and(eq("market", "ethglobal-mumbai"), eq("privacy", "TeeML")))
  .fetch()
```
