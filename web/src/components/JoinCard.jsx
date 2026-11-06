import { IDKitRequestWidget, proofOfHuman } from "@worldcoin/idkit"
import { useState } from "react"
import { api } from "../lib/api.js"

// Proof of Human is the least we can ask for: it stops a bot farm from draining the welcome
// USDT and the relayer's gas. A passport check would be overkill for a translation.
export function JoinCard({ account, onVerified, notify }) {
  const [request, setRequest] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function start() {
    setError("")
    setBusy(true)
    try {
      setRequest(await api.rpContext())
      setOpen(true)
    } catch (e) {
      setError(`Couldn't reach the server. ${e.message}`)
      setBusy(false)
    }
  }

  return (
    <section className="card join" aria-labelledby="join-title">
      <h2 id="join-title">Get 3 USDT of AI work, free</h2>
      <p className="muted">Prove you're one human and we'll top you up. No wallet, no gas, no sign-up.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn primary" onClick={start} disabled={busy}>
        {busy ? "Waiting for World ID…" : "Verify I'm human"}
      </button>

      {request && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setBusy(false)
          }}
          app_id={request.app_id}
          action={request.action}
          rp_context={request.rp_context}
          environment={request.environment}
          allow_legacy_proofs={request.allow_legacy_proofs}
          preset={proofOfHuman({ signal: account.address.toLowerCase() })}
          handleVerify={async (result) => {
            // Throwing here shows World's failure screen, and nothing is unlocked.
            const res = await api.verify(result, account.address)
            notify(res.returning ? "Welcome back. The welcome USDT is once per human." : "You're in. 3 USDT is on its way.")
          }}
          onSuccess={() => {
            setBusy(false)
            onVerified()
          }}
          onError={(code) => {
            setBusy(false)
            setError(code === "user_rejected" ? "Verification cancelled. You can still browse." : `World ID didn't complete (${code}).`)
          }}
        />
      )}
    </section>
  )
}
