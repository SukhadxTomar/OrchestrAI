import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Dev-server proxy so the frontend can talk to the FastAPI control plane
// (uvicorn on :8000) without CORS ceremony. The app degrades gracefully to
// simulation mode when the backend is down.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/api-ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
        rewrite: (path) => path.replace(/^\/api-ws/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["@monaco-editor/react"],
          xterm: ["@xterm/xterm", "@xterm/addon-fit"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
