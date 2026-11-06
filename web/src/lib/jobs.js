// This phone's reply key (results are sealed to it) and its job history. Both stay on the device:
// the reply secret is what makes the results readable only here.
import { newBoxKeys } from "../../../shared/seal.mjs"

const KEYS = "lc.replyKeys"
const JOBS = "lc.jobs"

function read(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(name)) ?? fallback
  } catch {
    return fallback
  }
}

function write(name, value) {
  try {
    localStorage.setItem(name, JSON.stringify(value))
  } catch {
    // Private mode: history lives for this tab only.
  }
}

let memoryKeys = null

export async function loadReplyKeys() {
  memoryKeys ??= read(KEYS, null) ?? (await newBoxKeys())
  write(KEYS, memoryKeys)
  return memoryKeys
}

export const loadJobs = () => read(JOBS, [])

export function saveJob(job) {
  const jobs = [job, ...loadJobs().filter((j) => j.jobKey !== job.jobKey)].slice(0, 30)
  write(JOBS, jobs)
  return jobs
}
