// Arkiv schemas shared by the server, the provider worker and the apps.
// Documented for judges in /arkiv/schema.md.
import { addr, bytes, dec, defineSchema, i32, key, str, u64 } from "@arkiv-network/sdk/schema"

/**
 * A provider's offer for today. Expires at the next 00:00 UTC, when 0G allowances reset,
 * so tomorrow's market starts empty. The price falls from startPrice to floorPrice over the day;
 * every app computes the same live price from these columns (see shared/pricing.mjs).
 */
export const Listing = defineSchema("lc.listing", {
  market: str().indexed(),
  provider: addr().indexed(), // also where USDT payouts go
  service: str().indexed(), // "translate" | "summarize" | "transcribe"
  model: str().indexed(), // the 0G model the provider will run
  privacy: str().indexed(), // "TeeML" when the model runs in an attested enclave
  startPrice: dec(),
  floorPrice: dec(),
  opensAt: u64(), // unix seconds
  resetsAt: u64(), // unix seconds, next 00:00 UTC
  capacity: i32(), // jobs the provider will take today
  boxKey: str(), // provider's X25519 public key (hex): buyers encrypt jobs to it
  title: str(),
})

/** A paid job. Only ciphertext: the server that writes it can't read it. */
export const Job = defineSchema("lc.job", {
  market: str().indexed(),
  listingKey: key().indexed(),
  provider: addr().indexed(),
  buyer: addr().indexed(),
  service: str().indexed(),
  price: dec(),
  input: bytes(), // sealed to the provider's boxKey
  replyKey: str(), // buyer's X25519 public key (hex) for the result
  whitechainTx: str(),
})

/** The finished work, sealed to the buyer, with the 0G request ID as the receipt. */
export const Result = defineSchema("lc.result", {
  market: str().indexed(),
  jobKey: key().indexed(),
  provider: addr().indexed(),
  buyer: addr().indexed(),
  model: str(),
  zgRequestId: str(),
  output: bytes(), // sealed to the buyer's replyKey
})
