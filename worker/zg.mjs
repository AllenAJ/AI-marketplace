// The provider's own 0G calls. The API key never leaves the provider's machine.
const ROUTER = process.env.ZG_ROUTER ?? "https://router-api.0g.ai/v1"

/** What each service runs. The listing promises this model, so the worker never swaps it silently. */
export const SERVICES = {
  translate: { model: "glm-5.3", privacy: "TeeML", title: "Translate into any Indian language" },
  summarize: { model: "glm-5.3", privacy: "TeeML", title: "Summarize a document in 5 bullets" },
  transcribe: { model: "qwen3.5-omni-flash", privacy: "standard", title: "Transcribe a voice note" },
}

async function call(path, body) {
  const res = await fetch(`${ROUTER}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.ZG_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  // The gateway's request ID comes first; it is the receipt 0G's prize asks for.
  const requestId = res.headers.get("x-request-id")?.split(",")[0].trim() ?? ""
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) throw new Error(`0G ${res.status}: ${json.error?.message ?? "no body"} (request ${requestId})`)
  return { text: json.choices[0].message.content.trim(), requestId, usage: json.usage }
}

const chat = (model, system, user) =>
  call("/chat/completions", {
    model,
    // Low reasoning keeps answers clean and fast on glm-5.3 (no thinking text in the output).
    reasoning_effort: "low",
    max_tokens: 1200,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })

export async function runService(service, input) {
  const { model } = SERVICES[service]
  if (service === "translate") {
    return { model, ...(await chat(model, `Translate the user's text into ${input.to}. Reply with only the translation.`, input.text)) }
  }
  if (service === "summarize") {
    return { model, ...(await chat(model, "Summarize the user's text in at most 5 short bullet points. Reply with only the bullets.", input.text)) }
  }
  if (service === "transcribe") {
    const result = await call("/chat/completions", {
      model,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            { type: "input_audio", input_audio: { data: `data:${input.mime};base64,${input.audio}`, format: input.format } },
            { type: "text", text: "Transcribe this audio exactly, in its original language. Reply with only the transcript." },
          ],
        },
      ],
    })
    return { model, ...result }
  }
  throw new Error(`Unknown service ${service}`)
}
