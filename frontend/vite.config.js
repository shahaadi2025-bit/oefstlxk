import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The 3D hero is its own lazily loaded chunk (three.js); it never blocks first paint of the dashboard.
  build: { chunkSizeWarningLimit: 700 },
  server: { proxy: { "/api": "http://localhost:8000" } },
});
