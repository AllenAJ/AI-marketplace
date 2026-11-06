import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  // Schemas, pricing and sealing live in ../shared and are shared with the server and worker.
  // dedupe makes their imports resolve to this app's copies.
  resolve: { dedupe: ["@arkiv-network/sdk", "viem", "libsodium-wrappers"] },
  server: { fs: { allow: [".."] } },
})
