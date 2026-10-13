import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error — sunucu modülleri düz JS (ESM), tip bildirimi yok
import { apiOlustur } from "./server/api.js";

/** Derlenen arayüzün hangi commit'ten üretildiğini dist/.atlas-surum'a yazar (sunucu "derleme eski" uyarısı için). */
function surumIsareti() {
  let cikti = "dist";
  return {
    name: "atlas-surum",
    apply: "build" as const,
    configResolved(c: ResolvedConfig) {
      cikti = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      try {
        const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
        writeFileSync(join(cikti, ".atlas-surum"), commit);
      } catch {
        // git yoksa işaret yazılmaz; sunucu "bilinmiyor" der
      }
    },
  };
}

// Geliştirmede API ayrı süreç değil: aynı Vite sunucusuna ara katman olarak takılır.
export default defineConfig({
  plugins: [
    react(),
    surumIsareti(),
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
