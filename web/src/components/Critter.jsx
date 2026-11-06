// Wild Ones critters, animated from sprite strips in /public/critters (built from the original
// game frames). Strips are 2x, so they're shown at half size for sharp retina rendering.
import strips from "./critters.json"

export const CRITTERS = {
  translate: { kind: "fox", name: "Fox" },
  summarize: { kind: "koala", name: "Koala" },
  transcribe: { kind: "rabbit", name: "Rabbit" },
}

export function Critter({ kind, anim = "idle", height = 72, className = "" }) {
  const strip = strips[`${kind}-${anim}`]
  // Keep the critter the same size whichever animation plays: scale from the idle strip.
  const scale = height / strips[`${kind}-idle`].h
  const w = Math.round(strip.w * scale)
  const h = Math.round(strip.h * scale)
  return (
    <span
      className={`critter ${className}`}
      aria-hidden="true"
      style={{
        "--w": `${w}px`,
        "--h": `${h}px`,
        "--frames": strip.frames,
        "--duration": `${strip.frames / 12}s`,
        backgroundImage: `url(/critters/${kind}-${anim}.webp)`,
      }}
    />
  )
}
