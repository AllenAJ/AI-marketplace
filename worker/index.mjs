// The provider worker: runs on the provider's own machine with their own 0G key.
// It lists today's services on Arkiv, picks up paid jobs addressed to it, runs them on 0G,
// and returns sealed results. Nobody else ever holds the provider's 0G key or box secret.
import { ExpirationTime } from "@arkiv-network/sdk"
import { and, eq } from "@arkiv-network/sdk/query"
import { addr, bytes, dec, i32, key, u64 } from "@arkiv-network/sdk/schema"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { privateKeyToAccount } from "viem/accounts"
import { arkivPublic, arkivWallet, MARKET, required, serialQueue } from "../shared/clients.mjs"
import { nextResetUtc, priceAt } from "../shared/pricing.mjs"
import { Job, Listing, Result } from "../shared/schemas.mjs"
import { newBoxKeys, open, seal } from "../shared/seal.mjs"
import { runService, SERVICES } from "./zg.mjs"

const POLL_MS = 3000
const PRICES = {
  translate: { start: "0.60", floor: "0.10" },
  summarize: { start: "0.80", floor: "0.15" },
  transcribe: { start: "0.50", floor: "0.10" },
}
const CAPACITY = 50

const account = privateKeyToAccount(required("PROVIDER_PRIVATE_KEY"))
const wallet = arkivWallet(account)
const write = serialQueue()

// The box key pair stays on this machine. Jobs are sealed to its public half.
const BOX_FILE = new URL("./.boxkeys.json", import.meta.url)
const boxKeys = existsSync(BOX_FILE) ? JSON.parse(readFileSync(BOX_FILE, "utf8")) : await newBoxKeys()
if (!existsSync(BOX_FILE)) writeFileSync(BOX_FILE, JSON.stringify(boxKeys), { mode: 0o600 })

const log = (icon, message) => console.log(`${new Date().toLocaleTimeString()}  ${icon}  ${message}`)

/** Make sure today's listings exist. They vanish at 00:00 UTC with the allowance they sell work from. */
async function ensureListings() {
  const resetsAt = nextResetUtc()
  const { entities } = await arkivPublic
    .select({ $key: true, service: true, resetsAt: true })
    .from(Listing)
    .where(and(eq("market", MARKET), eq("provider", addr(account.address))))
    .fetch()
  const live = new Set(entities.filter((e) => Number(e.resetsAt.value) === resetsAt).map((e) => e.service.value))
  for (const [service, spec] of Object.entries(SERVICES)) {
    if (live.has(service)) continue
    const opensAt = Math.floor(Date.now() / 1000)
    const { entityKey } = await write(() =>
      wallet.createEntity(
        Listing,
        {
          market: MARKET,
          provider: addr(account.address),
          service,
          model: spec.model,
          privacy: spec.privacy,
          startPrice: dec(PRICES[service].start),
          floorPrice: dec(PRICES[service].floor),
          opensAt: u64(BigInt(opensAt)),
          resetsAt: u64(BigInt(resetsAt)),
          capacity: i32(CAPACITY),
          boxKey: boxKeys.publicKey,
          title: spec.title,
        },
        { expiration: ExpirationTime.atDate(new Date(resetsAt * 1000)) },
      ),
    )
    log("🏷️ ", `listed ${service} on ${spec.model} (${spec.privacy}), ${PRICES[service].start} → ${PRICES[service].floor} USDT by reset · ${entityKey.slice(0, 10)}…`)
  }
}

const done = new Set()

async function handle(job) {
  done.add(job.$key)
  const service = job.service.value
  log("📥", `job ${job.$key.slice(0, 10)}… ${service}, paid ${job.price.value} USDT (Whitechain ${job.whitechainTx.value.slice(0, 10)}…)`)
  const input = await open(job.input.value, boxKeys)
  const t0 = Date.now()
  const result = await runService(service, input)
  log("🧠", `ran ${result.model} on 0G in ${Date.now() - t0} ms · request ${result.requestId}`)
  const output = await seal({ text: result.text }, job.replyKey.value)
  const { entityKey } = await write(() =>
    wallet.createEntity(
      Result,
      {
        market: MARKET,
        jobKey: key(job.$key),
        provider: addr(account.address),
        buyer: addr(job.buyer.value),
        model: result.model,
        zgRequestId: result.requestId,
        output: bytes(output),
      },
      { expiration: ExpirationTime.fromDays(1) },
    ),
  )
  log("📤", `sealed result for the buyer · ${entityKey.slice(0, 10)}…`)
}

async function poll() {
  const { entities: jobs } = await arkivPublic
    .select()
    .from(Job)
    .where(and(eq("market", MARKET), eq("provider", addr(account.address))))
    .limit(50)
    .fetch()
  for (const job of jobs) {
    if (done.has(job.$key)) continue
    // A job already answered (by an earlier run of this worker) is skipped.
    const { entities: answered } = await arkivPublic.select({ $key: true }).from(Result).where(eq("jobKey", key(job.$key))).limit(1).fetch()
    if (answered.length) {
      done.add(job.$key)
      continue
    }
    handle(job).catch((e) => {
      done.delete(job.$key) // retry on the next poll
      log("⚠️ ", `job ${job.$key.slice(0, 10)}… failed: ${e.message}`)
    })
  }
}

log("🌙", `Last Call worker for ${account.address} in market "${MARKET}"`)
await ensureListings()
for (const [service, p] of Object.entries(PRICES)) log("💸", `${service} now ${priceAt({ startPrice: p.start, floorPrice: p.floor, opensAt: Date.now() / 1000, resetsAt: nextResetUtc() }).toFixed(4)} USDT`)
log("👀", "watching Arkiv for paid jobs…")
setInterval(() => poll().catch((e) => log("⚠️ ", `poll failed: ${e.message}`)), POLL_MS)
setInterval(() => ensureListings().catch((e) => log("⚠️ ", `listing refresh failed: ${e.message}`)), 10 * 60 * 1000)
