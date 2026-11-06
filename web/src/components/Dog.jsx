// Dogi's mascot and Shiba faces, shared with the Dogi app: the pug walks while a job runs,
// and each service has its own face from the 6 x 3 sticker sheet (600 x 372).
const COLS = 6
const ROWS = 3
const SHEET_W = 600
const SHEET_H = 372

export const FACES = {
  translate: { col: 0, row: 2 }, // tongue out, chatty
  summarize: { col: 3, row: 0 }, // sunglasses, has read it all
  transcribe: { col: 2, row: 1 }, // whistling, all ears
  done: { col: 5, row: 2 }, // shouting with joy
  sleepy: { col: 4, row: 1 }, // zzz, nothing yet
  sad: { col: 1, row: 1 }, // crying, something failed
}

export const SERVICE_NAMES = { translate: "Translator", summarize: "Summarizer", transcribe: "Listener" }

export function Face({ face, size = 56, className = "" }) {
  const { col, row } = FACES[face]
  const cellW = SHEET_W / COLS
  const cellH = SHEET_H / ROWS
  const scale = size / cellW
  return (
    <span
      className={`face ${className}`}
      aria-hidden="true"
      style={{
        width: size,
        height: Math.round(cellH * scale),
        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
        backgroundPosition: `${-col * cellW * scale}px ${-row * cellH * scale}px`,
      }}
    />
  )
}

/** The walking pixel pug (4:3), Dogi's logo and loading state. */
export function Pug({ size = 40, className = "" }) {
  return <img src="/mascot.gif" alt="" aria-hidden="true" width={size} height={Math.round(size * 0.75)} className={`pug ${className}`} />
}
