import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = "http://127.0.0.1:8437";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5437,
    strictPort: true,
    proxy: {
      "/api": backendTarget,
      "/generated": backendTarget,
      "/health": backendTarget,
      "/healthz": backendTarget
    }
  }
});
