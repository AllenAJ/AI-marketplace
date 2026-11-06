// Chain clients for Node (server, worker, scripts). Secrets come from .env.
import { createPublicClient as createArkivPublicClient, createWalletClient as createArkivWalletClient } from "@arkiv-network/sdk"
import { rabdi } from "@arkiv-network/sdk/chains"
import { createPublicClient, createWalletClient, defineChain, http } from "viem"

export function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in .env`)
  return value
}

export const MARKET = process.env.MARKET ?? "ethglobal-mumbai"

const arkivChain = rabdi({ accessKey: required("ARKIV_ACCESS_KEY") })
export const arkivPublic = createArkivPublicClient({ chain: arkivChain, transport: http() })
export const arkivWallet = (account) => createArkivWalletClient({ chain: arkivChain, transport: http(), account })

export const whitechain = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [process.env.WHITECHAIN_RPC ?? "https://rpc.testnet.whitechain.io"] } },
  blockExplorers: { default: { name: "Whitechain Explorer", url: "https://explorer.testnet.whitechain.io" } },
})
export const wcPublic = createPublicClient({ chain: whitechain, transport: http() })
export const wcWallet = (account) => createWalletClient({ chain: whitechain, transport: http(), account })

/** Runs async jobs one at a time, so one key never races itself for a nonce. */
export function serialQueue() {
  let tail = Promise.resolve()
  return (job) => {
    const run = tail.then(job, job)
    tail = run.catch(() => {})
    return run
  }
}
