import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error — sunucu modülleri düz JS (ESM), tip bildirimi yok
import { apiOlustur } from "./server/api.js";

// Geliştirmede API ayrı süreç değil: aynı Vite sunucusuna ara katman olarak takılır.
export default defineConfig({
  plugins: [
    react(),
    {
      name: "atlas-api",
      configureServer(server) {
        const api = apiOlustur();
        server.middlewares.use((req, res, next) => api.isle(req, res, next));
        server.httpServer?.once("close", () => api.durdur());
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4321, strictPort: true },
});
