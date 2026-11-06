// Rehearsal helper: mark a test phone verified (stands in for World ID) and give it test USDT.
//   pnpm dev:fund <wallet> [usdt]
import { getAddress, parseUnits } from "viem"
import { config, erc20Abi, wc } from "../server/config.mjs"
import { humans } from "../server/db.mjs"

const [walletArg, usdt = "1"] = process.argv.slice(2)
const wallet = getAddress(walletArg)
if (!humans.byWallet(wallet)) humans.insert(`dev-${Date.now()}`, wallet)
const hash = await wc.wallet.writeContract({ address: config.usdt, abi: erc20Abi, functionName: "transfer", args: [wallet, parseUnits(usdt, 6)] })
await wc.public.waitForTransactionReceipt({ hash })
console.log(`${wallet} verified for testing, ${usdt} USDT: ${hash}`)
