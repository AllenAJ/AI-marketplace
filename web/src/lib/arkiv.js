// The app reads Arkiv directly: listings and results never pass through our server.
import { createPublicClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { key } from "@arkiv-network/sdk/schema"
import { http } from "viem"
import { Listing, Result } from "../../../shared/schemas.mjs"
import { ARKIV_ACCESS_KEY } from "./env.js"

export const arkivPublic = createPublicClient({ chain: rabdi({ accessKey: ARKIV_ACCESS_KEY }), transport: http() })

const flat = (entity) => {
  const out = { key: entity.$key }
  for (const [k, v] of Object.entries(entity)) if (!k.startsWith("$")) out[k] = v?.value ?? v
  return out
}

/** Today's live listings in a market. Expired ones are already gone from Arkiv. */
export async function fetchListings(market) {
  const { entities } = await arkivPublic.select().from(Listing).where(eq("market", market)).limit(100).fetch()
  return entities.map(flat)
}

/** The provider's sealed answer for a job, or null while they're still working. */
export async function fetchResult(jobKey) {
  const { entities } = await arkivPublic.select().from(Result).where(eq("jobKey", key(jobKey))).limit(1).fetch()
  return entities[0] ? flat(entities[0]) : null
}
