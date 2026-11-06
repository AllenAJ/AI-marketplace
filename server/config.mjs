// Server config and clients. Same shape as Vanishing Bazaar's, so world.mjs and db.mjs are shared as is.
import { privateKeyToAccount } from "viem/accounts"
import { arkivPublic, arkivWallet, MARKET, required, serialQueue, wcPublic, wcWallet, whitechain } from "../shared/clients.mjs"

export const config = {
  port: Number(process.env.PORT ?? 8788),
  market: MARKET,
  bazaar: required("BAZAAR_ADDRESS"), // the verified checkout contract, reused: stallKey = listingKey
  usdt: required("WHITECHAIN_USDT"),
  world: {
    appId: required("WORLD_APP_ID"),
    rpId: required("WORLD_RP_ID"),
    signingKey: required("WORLD_SIGNING_KEY"),
    environment: process.env.WORLD_ENVIRONMENT ?? "staging",
    action: "open-stall",
    allowLegacyProofs: process.env.WORLD_ALLOW_LEGACY === "true",
  },
  giftUsdt: 3_000_000n, // 3 USDT so a new buyer can try a few jobs
  dripGlm: 20_000_000_000_000_000n, // 0.02 tGLM
  maxRelaysPerHour: 20,
}

export { whitechain }
export const account = privateKeyToAccount(required("SERVER_PRIVATE_KEY"))
export const wc = { public: wcPublic, wallet: wcWallet(account) }
export const arkiv = { public: arkivPublic, wallet: arkivWallet(account) }
export const whitechainQueue = serialQueue()
export const arkivQueue = serialQueue()

export const erc20Abi = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
]

export const bazaarAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "stallKey", type: "bytes32" },
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "price", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "permit",
        type: "tuple",
        components: [
          { name: "deadline", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
      },
      { name: "buyerSig", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "error", name: "OrderExpired", inputs: [] },
  { type: "error", name: "OrderAlreadyFilled", inputs: [] },
  { type: "error", name: "BadSignature", inputs: [] },
  { type: "error", name: "ZeroPrice", inputs: [] },
]
