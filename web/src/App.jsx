import { useCallback, useEffect, useMemo, useState } from "react"
import { nextResetUtc, priceAt } from "../../shared/pricing.mjs"
import { Critter, CRITTERS } from "./components/Critter.jsx"
import { JobSheet } from "./components/JobSheet.jsx"
import { JoinCard } from "./components/JoinCard.jsx"
import { api } from "./lib/api.js"
import { fetchListings } from "./lib/arkiv.js"
import { loadBurner } from "./lib/burner.js"
import { loadJobs, loadReplyKeys } from "./lib/jobs.js"
import { txUrl, usdtBalance } from "./lib/whitechain.js"

const POLL_MS = 5000
const account = loadBurner()
const SERVICES = [
  { id: "translate", name: "Translate", blurb: "Fox turns any text into Malayalam, Hindi, Tamil and more" },
  { id: "summarize", name: "Summarize", blurb: "Koala reads the long thing and gives you 5 bullets" },
  { id: "transcribe", name: "Transcribe", blurb: "Rabbit listens to your voice note and writes it down" },
]

function useNow(ms) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function untilReset(now) {
  const s = Math.max(0, nextResetUtc(new Date(now)) - Math.floor(now / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`
}

export function App() {
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState("")
  const [verified, setVerified] = useState(false)
  const [replyKeys, setReplyKeys] = useState(null)
  const [listings, setListings] = useState(null)
  const [listError, setListError] = useState("")
  const [balance, setBalance] = useState(null)
  const [tab, setTab] = useState("services")
  const [open, setOpen] = useState(null)
  const [jobs, setJobs] = useState(loadJobs)
  const [toast, setToast] = useState("")
  const now = useNow(1000)

  const notify = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(""), 3500)
  }, [])

  const loadConfig = useCallback(() => {
    setConfigError("")
    api.config().then(setConfig).catch((e) => setConfigError(e.message))
  }, [])
  useEffect(loadConfig, [loadConfig])
  useEffect(() => {
    loadReplyKeys().then(setReplyKeys)
    api.me(account.address).then((me) => setVerified(me.verified)).catch(() => {})
  }, [])

  const refresh = useCallback(async () => {
    if (!config) return
    try {
      setListings(await fetchListings(config.market))
      setListError("")
    } catch (e) {
      setListError(e.shortMessage ?? e.message)
    }
    const raw = await usdtBalance(config.usdt, account.address).catch(() => null)
    if (raw !== null) setBalance(Number(raw) / 1e6)
  }, [config])

  useEffect(() => {
    if (!config) return
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [config, refresh])

  // The cheapest live offer per service, at this second's price.
  const offers = useMemo(() => {
    const by = {}
    for (const l of listings ?? []) {
      const price = priceAt(l, now / 1000)
      const best = by[l.service]
      by[l.service] = { cheapest: !best || price < best.price ? { ...l } : best.cheapest, price: !best || price < best.price ? price : best.price, count: (best?.count ?? 0) + 1 }
    }
    return by
  }, [listings, now])

  if (configError) {
    return (
      <main className="shell">
        <div className="card stack" role="alert">
          <h1 className="brand">Last Call</h1>
          <p className="error">Can't reach the server: {configError}</p>
          <button type="button" className="btn primary" onClick={loadConfig}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="shell">
      <header className="top">
        <h1 className="brand">
          Last <span>Call</span>
        </h1>
        <p className="wallet" aria-label="Your balance">
          {balance === null ? "…" : `${balance.toFixed(2)} USDT`}
        </p>
      </header>

      <section className="hero" aria-labelledby="clock-label">
        <p id="clock-label" className="hero-kicker">
          Spare AI time vanishes at midnight UTC in
        </p>
        <p className="clock" aria-live="off">
          {untilReset(now)}
        </p>
        <p className="hero-sub">Until then, the crew works it off cheap. Prices drop every second.</p>
        <div className="hero-crew">
          <Critter kind="rabbit" height={78} />
          <Critter kind="koala" height={72} />
          <Critter kind="fox" height={76} />
        </div>
      </section>

      {!verified && config && (
        <JoinCard
          account={account}
          notify={notify}
          onVerified={() => {
            setVerified(true)
            setTimeout(refresh, 4000)
          }}
        />
      )}

      <nav className="tabs two" aria-label="Sections">
        {[
          ["services", "AI jobs"],
          ["jobs", `My jobs${jobs.length ? ` (${jobs.length})` : ""}`],
        ].map(([id, label]) => (
          <button key={id} type="button" className="tab" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "services" ? (
        listings === null ? (
          listError ? (
            <div className="card stack" role="alert">
              <p className="error">Couldn't load offers: {listError}</p>
              <button type="button" className="btn" onClick={refresh}>
                Retry
              </button>
            </div>
          ) : (
            <ul className="services" aria-busy="true" aria-label="Loading offers">
              {SERVICES.map((s) => (
                <li key={s.id} className="service skeleton" />
              ))}
            </ul>
          )
        ) : (
          <ul className="services" aria-label="AI jobs">
            {SERVICES.map((s) => {
              const offer = offers[s.id]
              return (
                <li key={s.id}>
                  <button type="button" className="service" disabled={!offer || !replyKeys} onClick={() => setOpen({ service: s.id, offer: offer.cheapest })}>
                    <span className="service-critter">
                      <Critter kind={CRITTERS[s.id].kind} height={88} />
                    </span>
                    <span className="service-body">
                      <span className="service-name">{s.name}</span>
                      <span className="service-blurb">{s.blurb}</span>
                      {offer ? (
                        <span className="service-meta">
                          <span className={`badge ${offer.cheapest.privacy === "TeeML" ? "tee" : ""}`}>{offer.cheapest.privacy === "TeeML" ? "Private enclave" : "Standard"}</span>
                          {offer.count} {offer.count === 1 ? "provider" : "providers"}
                        </span>
                      ) : (
                        <span className="service-meta">No providers right now</span>
                      )}
                    </span>
                    {offer && (
                      <span className="service-price">
                        <span className="price">{offer.price.toFixed(4)}</span>
                        <span className="unit">USDT ↓</span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : jobs.length === 0 ? (
        <div className="card stack center">
          <p className="empty-emoji" aria-hidden="true">
            🌙
          </p>
          <p>No jobs yet. Your results stay on this phone, readable only here.</p>
          <button type="button" className="btn primary" onClick={() => setTab("services")}>
            Try a job
          </button>
        </div>
      ) : (
        <ul className="jobs" aria-label="Your jobs">
          {jobs.map((job) => (
            <li key={job.jobKey} className="card job">
              <p className="job-head">
                <Critter kind={CRITTERS[job.service].kind} height={36} />
                <span>
                  <strong>{SERVICES.find((s) => s.id === job.service)?.name}</strong> · {job.price} USDT · {new Date(job.at).toLocaleTimeString()}
                </span>
              </p>
              <p className="muted">{job.preview}</p>
              {job.answer ? <p className="answer">{job.answer}</p> : <p className="working">Waiting for the provider…</p>}
              <p className="fine">
                <a className="link" href={txUrl(job.whitechainTx)} target="_blank" rel="noreferrer">
                  Payment
                </a>
                {job.zgRequestId && <> · 0G request <span className="mono">{job.zgRequestId}</span></>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {open && config && replyKeys && (
        <JobSheet
          service={open.service}
          offer={offers[open.service]?.cheapest ?? open.offer}
          account={account}
          config={config}
          replyKeys={replyKeys}
          verified={verified}
          balance={balance}
          onClose={() => {
            setOpen(null)
            setJobs(loadJobs())
          }}
          onPaid={() => {
            setJobs(loadJobs())
            refresh()
          }}
          onNeedJoin={() => {
            setOpen(null)
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        />
      )}

      <div className="toast" role="status" aria-live="polite" data-show={Boolean(toast) || undefined}>
        {toast}
      </div>
    </main>
  )
}
