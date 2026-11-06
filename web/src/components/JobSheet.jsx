import { useEffect, useRef, useState } from "react"
import { toHex } from "viem"
import { priceUnitsAt } from "../../../shared/pricing.mjs"
import { open as openBox, seal } from "../../../shared/seal.mjs"
import { api } from "../lib/api.js"
import { fetchResult } from "../lib/arkiv.js"
import { saveJob } from "../lib/jobs.js"
import { signPurchase, txUrl } from "../lib/whitechain.js"

const LANGUAGES = ["Malayalam", "Hindi", "Marathi", "Tamil", "Bengali", "English", "Japanese"]
const MAX_RECORD_MS = 20_000

const fmt = (units) => (Number(units) / 1e6).toFixed(4)

// Chunked, so a long recording doesn't overflow the argument limit of String.fromCharCode.
function toBase64(bytes) {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function useRecorder() {
  const [state, setState] = useState({ recording: false, clip: null, error: "" })
  const recorder = useRef(null)
  const timer = useRef(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Chrome records WebM/Opus, Safari MP4/AAC: 0G's audio model takes both.
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24_000 })
      const chunks = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: mime })
        const base64 = toBase64(new Uint8Array(await blob.arrayBuffer()))
        setState({ recording: false, error: "", clip: { audio: base64, mime, format: mime === "audio/webm" ? "webm" : "m4a", url: URL.createObjectURL(blob) } })
      }
      rec.start()
      recorder.current = rec
      timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORD_MS)
      setState({ recording: true, clip: null, error: "" })
    } catch {
      setState({ recording: false, clip: null, error: "Microphone blocked. Allow it in your browser settings." })
    }
  }

  function stop() {
    clearTimeout(timer.current)
    if (recorder.current?.state === "recording") recorder.current.stop()
  }

  return { ...state, start, stop }
}

export function JobSheet({ service, offer, account, config, replyKeys, verified, balance, onClose, onPaid, onNeedJoin }) {
  const dialog = useRef(null)
  const [text, setText] = useState("")
  const [to, setTo] = useState("Malayalam")
  const [step, setStep] = useState({ kind: "compose" })
  const recorder = useRecorder()
  const price = priceUnitsAt(offer, Date.now() / 1000)
  // Only while composing: once paying, the refreshed balance already has this job taken out.
  const short = step.kind === "compose" && balance !== null && balance * 1e6 < Number(price)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  // Poll Arkiv for the provider's sealed answer, then open it with this phone's key.
  useEffect(() => {
    if (step.kind !== "working") return
    let live = true
    const tick = async () => {
      const result = await fetchResult(step.jobKey).catch(() => null)
      if (!live) return
      if (!result) return void setTimeout(tick, 2500)
      const { text: answer } = await openBox(result.output, replyKeys)
      saveJob({ ...step.record, answer, model: result.model, zgRequestId: result.zgRequestId })
      setStep({ ...step, kind: "done", answer, model: result.model, zgRequestId: result.zgRequestId })
    }
    tick()
    return () => {
      live = false
    }
  }, [step.kind, step.jobKey])

  async function pay(event) {
    event.preventDefault()
    let input
    if (service === "transcribe") {
      if (!recorder.clip) return setStep({ kind: "compose", error: "Record a voice note first." })
      input = { audio: recorder.clip.audio, mime: recorder.clip.mime, format: recorder.clip.format }
    } else {
      if (!text.trim()) return setStep({ kind: "compose", error: "Paste or type some text first." })
      input = service === "translate" ? { text: text.trim(), to } : { text: text.trim() }
    }
    try {
      setStep({ kind: "paying" })
      // Sealed on this phone to the provider's key: our server and Arkiv only ever see ciphertext.
      const sealed = await seal(input, offer.boxKey)
      const signed = await signPurchase(account, config, { listingKey: offer.key, provider: offer.provider, price })
      const { whitechainTx, jobKey } = await api.job(signed, { input: toHex(sealed), replyKey: replyKeys.publicKey })
      const record = {
        jobKey,
        service,
        whitechainTx,
        price: fmt(price),
        preview: service === "transcribe" ? "Voice note" : text.trim().slice(0, 80),
        privacy: offer.privacy,
        at: Date.now(),
      }
      saveJob(record)
      onPaid()
      setStep({ kind: "working", jobKey, whitechainTx, record })
    } catch (e) {
      setStep({ kind: "compose", error: e.message })
    }
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} aria-labelledby="job-title">
      <h2 id="job-title">{offer.title}</h2>
      <p className="muted">
        <span className={`badge ${offer.privacy === "TeeML" ? "tee" : ""}`}>{offer.privacy === "TeeML" ? "Private enclave" : "Standard"}</span> {offer.model}
      </p>

      {step.kind === "compose" || step.kind === "paying" ? (
        <form className="stack" onSubmit={pay}>
          {service === "transcribe" ? (
            <div className="stack center">
              <button type="button" className={`btn mic ${recorder.recording ? "live" : ""}`} onClick={recorder.recording ? recorder.stop : recorder.start} aria-pressed={recorder.recording}>
                {recorder.recording ? "Stop recording" : recorder.clip ? "Record again" : "Hold your phone close and tap to record"}
              </button>
              {recorder.clip && <audio controls src={recorder.clip.url} aria-label="Your voice note" />}
              {recorder.error && <p className="error">{recorder.error}</p>}
              <p className="fine">Up to 20 seconds, any language.</p>
            </div>
          ) : (
            <>
              <label htmlFor="job-text">{service === "translate" ? "Text to translate" : "Text to summarize"}</label>
              <textarea id="job-text" rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={service === "translate" ? "The chai is ready. Come to stall four." : "Paste an article, a contract or a long WhatsApp forward."} />
              {service === "translate" && (
                <>
                  <label htmlFor="job-to">Into</label>
                  <select id="job-to" value={to} onChange={(e) => setTo(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}

          {step.error && (
            <p className="error" role="alert">
              {step.error}
            </p>
          )}
          {!verified ? (
            <button type="button" className="btn primary big" onClick={onNeedJoin}>
              Verify to pay
            </button>
          ) : (
            <button type="submit" className="btn primary big" disabled={step.kind === "paying" || short}>
              {step.kind === "paying" ? "Sealing and paying…" : `Pay ${fmt(price)} USDT`}
            </button>
          )}
          {short && <p className="error">You have {balance.toFixed(2)} USDT, not enough for this job.</p>}
          <p className="fine">Sealed on your phone to this provider. We, Arkiv and everyone else see only ciphertext. No gas, no wallet popup.</p>
        </form>
      ) : step.kind === "working" ? (
        <div className="stack center" role="status">
          <p className="paid">Paid ✓</p>
          <p className="working">The provider is working on it…</p>
          <a className="link" href={txUrl(step.whitechainTx)} target="_blank" rel="noreferrer">
            See the payment on Whitechain
          </a>
        </div>
      ) : (
        <div className="stack">
          <p className="answer">{step.answer}</p>
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(step.answer)}>
            Copy
          </button>
          <dl className="receipt">
            <dt>Model</dt>
            <dd>{step.model}</dd>
            <dt>0G request</dt>
            <dd className="mono">{step.zgRequestId}</dd>
            <dt>Payment</dt>
            <dd>
              <a className="link" href={txUrl(step.whitechainTx)} target="_blank" rel="noreferrer">
                {step.whitechainTx.slice(0, 10)}…
              </a>
            </dd>
          </dl>
        </div>
      )}

      <form method="dialog">
        <button type="submit" className="btn ghost">
          Close
        </button>
      </form>
    </dialog>
  )
}
