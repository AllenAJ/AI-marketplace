// The live price of a listing at a moment: falls in a straight line from start to floor as the
// provider's allowance reset approaches. Pure, so the phone, the booth screen and the relayer agree.

/** Price in USDT (number) at unix-seconds `now`. */
export function priceAt(listing, now = Date.now() / 1000) {
  const start = Number(listing.startPrice)
  const floor = Number(listing.floorPrice)
  const opens = Number(listing.opensAt)
  const resets = Number(listing.resetsAt)
  if (now <= opens) return start
  if (now >= resets) return floor
  const left = (resets - now) / (resets - opens)
  return floor + (start - floor) * left
}

/** Price in USDT base units (6 decimals), rounded up so a buyer never underpays by rounding. */
export function priceUnitsAt(listing, now) {
  return BigInt(Math.ceil(priceAt(listing, now) * 1e6))
}

/** The next 00:00 UTC after `date`, in unix seconds: when 0G daily allowances reset. */
export function nextResetUtc(date = new Date()) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) / 1000)
}
