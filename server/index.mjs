import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { getAddress, isAddress } from "viem"
import { account, config, whitechain } from "./config.mjs"
import { humans } from "./db.mjs"
import { relayJob } from "./relay.mjs"
import { HttpError, rpContext, signalFor, verifyHuman } from "./world.mjs"

const app = new Hono()
app.use("/api/*", cors())

app.onError((error, c) => {
  if (error instanceof HttpError) return c.json({ error: error.message }, error.status)
  console.error(error)
  return c.json({ error: "Something went wrong" }, 500)
})

function walletParam(value) {
  if (!isAddress(value ?? "")) throw new HttpError(400, "Expected a wallet address")
  return getAddress(value)
}

app.get("/api/config", (c) =>
  c.json({
    market: config.market,
    bazaar: config.bazaar,
    usdt: config.usdt,
    whitechainChainId: whitechain.id,
    relayer: account.address,
    world: { appId: config.world.appId, action: config.world.action, environment: config.world.environment },
  }),
)

app.post("/api/world/rp-context", (c) => c.json(rpContext()))

app.post("/api/world/verify", async (c) => {
  const { result, wallet } = await c.req.json()
  return c.json(await verifyHuman(result, walletParam(wallet)))
})

app.get("/api/me/:wallet", (c) => {
  const wallet = walletParam(c.req.param("wallet"))
  return c.json({ wallet, verified: Boolean(humans.byWallet(wallet)), signal: signalFor(wallet) })
})

app.post("/api/relay/job", async (c) => c.json(await relayJob(await c.req.json())))

app.get("/api/health", (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`Last Call server on http://localhost:${port} (relayer ${account.address})`)
})
