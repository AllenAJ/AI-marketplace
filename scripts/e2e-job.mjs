// End-to-end paid job against the running server (pnpm server) and worker (pnpm worker).
// Plays a fresh buyer: finds the cheapest live listing on Arkiv, seals the job to the provider,
// pays gaslessly, then waits for the provider's sealed result and opens it.
// World ID is stood in for by marking the test buyer verified directly in the local DB.
//   pnpm e2e [service] ["text"]
import { and, eq } from "@arkiv-network/sdk/query"
import { key } from "@arkiv-network/sdk/schema"
import { formatUnits, parseSignature, toHex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { account as server, config, erc20Abi, wc } from "../server/config.mjs"
import { humans } from "../server/db.mjs"
import { arkivPublic, MARKET } from "../shared/clients.mjs"
import { priceAt, priceUnitsAt } from "../shared/pricing.mjs"
import { Listing, Result } from "../shared/schemas.mjs"
import { newBoxKeys, open, seal } from "../shared/seal.mjs"

const SERVER = process.env.SERVER_URL ?? `http://localhost:${config.port}`
const [service = "translate", text = "The chai is ready. Please come to stall number four before the market closes."] = process.argv.slice(2)

const buyer = privateKeyToAccount(generatePrivateKey())
const replyKeys = await newBoxKeys()
humans.insert(`e2e-${Date.now()}`, buyer.address)
console.log("buyer", buyer.address)

// 1. Cheapest live listing for the service, straight from Arkiv.
const { entities } = await arkivPublic.select().from(Listing).where(and(eq("market", MARKET), eq("service", service))).limit(50).fetch()
const now = Date.now() / 1000
const listings = entities
  .map((e) => ({ key: e.$key, ...Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v.value])) }))
  .sort((a, b) => priceAt(a, now) - priceAt(b, now))
if (!listings.length) throw new Error(`No live ${service} listings. Is the worker running?`)
const listing = listings[0]
const price = priceUnitsAt(listing, now)
console.log(`cheapest ${service}: ${listing.model} (${listing.privacy}) by ${listing.provider} at ${formatUnits(price, 6)} USDT`)

// 2. Give the buyer just enough test USDT (stands in for the World ID welcome gift).
const hash = await wc.wallet.writeContract({ address: config.usdt, abi: erc20Abi, functionName: "transfer", args: [buyer.address, price] })
await wc.public.waitForTransactionReceipt({ hash })

// 3. Seal the job to the provider and sign the purchase. No gas, no transaction from the buyer.
const input = await seal(service === "translate" ? { text, to: "Malayalam" } : { text }, listing.boxKey)
const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
const nonce = await wc.public.readContract({
  address: config.usdt,
  abi: [{ type: "function", name: "nonces", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }],
  functionName: "nonces",
  args: [buyer.address],
})
const permitSig = await buyer.signTypedData({
  domain: { name: "Tether USD", version: "1", chainId: 1874, verifyingContract: config.usdt },
  types: { Permit: [
    { name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" },
  ] },
  primaryType: "Permit",
  message: { owner: buyer.address, spender: config.bazaar, value: price, nonce, deadline },
})
const order = { stallKey: listing.key, seller: listing.provider, buyer: buyer.address, price, deadline }
const sig = await buyer.signTypedData({
  domain: { name: "VanishingBazaar", version: "1", chainId: 1874, verifyingContract: config.bazaar },
  types: { Order: [
    { name: "stallKey", type: "bytes32" }, { name: "seller", type: "address" }, { name: "buyer", type: "address" },
    { name: "price", type: "uint256" }, { name: "deadline", type: "uint256" },
  ] },
  primaryType: "Order",
  message: order,
})
const { v, r, s } = parseSignature(permitSig)

const t0 = Date.now()
const res = await fetch(`${SERVER}/api/relay/job`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    order: { ...order, price: price.toString(), deadline: deadline.toString() },
    permit: { deadline: deadline.toString(), v: Number(v), r, s },
    sig,
    job: { input: toHex(input), replyKey: replyKeys.publicKey },
  }),
})
const paid = await res.json()
if (!res.ok) throw new Error(`relay ${res.status}: ${paid.error}`)
console.log(`paid + job posted in ${Date.now() - t0} ms: whitechain ${paid.whitechainTx}, job ${paid.jobKey}`)

// 4. Wait for the provider's sealed result on Arkiv, then open it with the buyer's key.
for (let i = 0; i < 40; i++) {
  const { entities: results } = await arkivPublic.select().from(Result).where(eq("jobKey", key(paid.jobKey))).limit(1).fetch()
  if (results.length) {
    const result = results[0]
    const { text: answer } = await open(result.output.value, replyKeys)
    console.log(`result after ${Date.now() - t0} ms from ${result.model.value} (0G request ${result.zgRequestId.value}):\n\n${answer}\n`)
    console.log(`server could read the job? no: it only ever held ${input.length} bytes of ciphertext`)
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 3000))
}
throw new Error("No result within 2 minutes")
