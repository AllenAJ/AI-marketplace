// Gasless purchase of one job. The buyer signs an order and a USDT permit; we check the order
// against the live listing on Arkiv, pay the gas on Whitechain, then post the sealed job to Arkiv
// for the provider's worker. We only ever handle ciphertext: we can't read the job or the result.
import { ExpirationTime } from "@arkiv-network/sdk"
import { eq } from "@arkiv-network/sdk/query"
import { addr, bytes, dec, key } from "@arkiv-network/sdk/schema"
import { BaseError, ContractFunctionRevertedError, formatUnits, getAddress, hexToBytes, isHex } from "viem"
import { priceUnitsAt } from "../shared/pricing.mjs"
import { Job, Listing } from "../shared/schemas.mjs"
import { arkiv, arkivQueue, bazaarAbi, config, wc, whitechainQueue } from "./config.mjs"
import { humans, relays } from "./db.mjs"
import { HttpError } from "./world.mjs"

const HOUR = 60 * 60 * 1000
const MAX_INPUT_BYTES = 100 * 1024 // Arkiv allows 128 KiB of bytes per entity

export async function relayJob({ order, permit, sig, job }) {
  if (!order || !permit || !isHex(sig) || !job) throw new HttpError(400, "Expected { order, permit, sig, job }")
  if (!isHex(order.stallKey, { strict: true }) || order.stallKey.length !== 66) throw new HttpError(400, "Bad listing key")
  if (!isHex(job.input) || !/^[0-9a-f]{64}$/i.test(job.replyKey ?? "")) throw new HttpError(400, "Expected a sealed input and a reply key")
  const input = hexToBytes(job.input)
  if (input.length > MAX_INPUT_BYTES) throw new HttpError(413, "That job is too big. Try a shorter voice note or text.")

  const buyer = getAddress(order.buyer)
  const provider = getAddress(order.seller)
  const price = BigInt(order.price)

  // Drain protection: only verified humans, and only so many sponsored jobs an hour.
  if (!humans.byWallet(buyer)) throw new HttpError(403, "Verify with World ID before buying")
  if (relays.countSince(buyer, Date.now() - HOUR) >= config.maxRelaysPerHour) throw new HttpError(429, "Too many jobs this hour")

  // The listing must still be live on Arkiv, and the order must pay at least its current price.
  let listing
  try {
    listing = await arkiv.public.getEntity(order.stallKey, Listing)
  } catch {
    throw new HttpError(410, "This listing has expired")
  }
  const live = Object.fromEntries(Object.entries(listing).map(([k, v]) => [k, v?.value ?? v]))
  if (live.market !== config.market) throw new HttpError(400, "Listing is in another market")
  if (getAddress(live.$owner) !== provider || getAddress(live.provider) !== provider) throw new HttpError(400, "Order provider does not own this listing")
  if (price < priceUnitsAt(live, Date.now() / 1000)) throw new HttpError(400, "Order pays less than the listing's current price")

  const { entities: taken } = await arkiv.public.select({ $key: true }).from(Job).where(eq("listingKey", key(order.stallKey))).limit(100).fetch()
  if (taken.length >= Number(live.capacity)) throw new HttpError(409, "This provider is fully booked today")

  const args = [
    { stallKey: order.stallKey, seller: provider, buyer, price, deadline: BigInt(order.deadline) },
    { deadline: BigInt(permit.deadline), v: Number(permit.v), r: permit.r, s: permit.s },
    sig,
  ]

  const whitechainTx = await whitechainQueue(async () => {
    try {
      const { request } = await wc.public.simulateContract({ account: wc.wallet.account, address: config.bazaar, abi: bazaarAbi, functionName: "buy", args })
      const hash = await wc.wallet.writeContract(request)
      const receipt = await wc.public.waitForTransactionReceipt({ hash })
      if (receipt.status !== "success") throw new HttpError(502, `Payment reverted: ${hash}`)
      return hash
    } catch (error) {
      if (error instanceof HttpError) throw error
      const revert = error instanceof BaseError && error.walk((e) => e instanceof ContractFunctionRevertedError)
      const reason = revert?.data?.errorName === "Error" ? revert.data.args?.[0] : (revert?.data?.errorName ?? revert?.reason)
      throw new HttpError(400, `Payment rejected: ${reason ?? error.shortMessage ?? error.message}`)
    }
  })
  relays.record(buyer)

  // The provider's worker watches Arkiv for this. It is the only one who can open `input`.
  const { entityKey: jobKey } = await arkivQueue(() =>
    arkiv.wallet.createEntity(
      Job,
      {
        market: config.market,
        listingKey: key(order.stallKey),
        provider: addr(provider),
        buyer: addr(buyer),
        service: live.service,
        price: dec(formatUnits(price, 6)),
        input: bytes(input),
        replyKey: job.replyKey.toLowerCase(),
        whitechainTx,
      },
      { expiration: ExpirationTime.fromDays(1) },
    ),
  )
  return { whitechainTx, jobKey }
}
