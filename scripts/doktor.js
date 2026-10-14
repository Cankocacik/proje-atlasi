// Kurulum denetimi: `npm run doktor` — sorun varsa çıkış kodu 1.
// Sunucuda pm2'nin ortamıyla aynı ayarları görmek için ATLAS_ORTAM/ATLAS_HOST/ATLAS_PORTAL_EPOSTA
// ecosystem.config.cjs'ten, gizli değerler .env'den okunur.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(KOK, ".env"))) process.loadEnvFile(join(KOK, ".env"));

// --yerel verilmedikçe sunucu ayarları ecosystem'den alınır (pm2'nin göreceği ortam).
if (!process.argv.includes("--yerel")) {
  const require = createRequire(import.meta.url);
  const uygulama = require(join(KOK, "ecosystem.config.cjs")).apps?.[0];
  for (const [k, v] of Object.entries(uygulama?.env ?? {})) process.env[k] ??= String(v);
}

const { doktor } = await import("../server/doktor.js");
const { ortamOku } = await import("../server/ortam.js");
const { manifestOku } = await import("../server/topla.js");

const renk = { ok: "\x1b[32m✓\x1b[0m", uyari: "\x1b[33m!\x1b[0m", hata: "\x1b[31m✗\x1b[0m", atla: "\x1b[90m·\x1b[0m" };
const ayar = ortamOku();
console.log(`\nProje Atlası kurulum denetimi — ${ayar.ortam}${ayar.host ? ` · ${ayar.host}` : ""}\n`);

const { sonuclar, ozet } = await doktor({ ayar, manifest: await manifestOku(), kok: KOK });
for (const s of sonuclar) {
  console.log(`${renk[s.durum] ?? "?"} ${s.ad.padEnd(34)} ${s.mesaj}`);
  if (s.cozum && (s.durum === "hata" || s.durum === "uyari")) console.log(`  \x1b[90m→ ${s.cozum}\x1b[0m`);
}
console.log(`\n${ozet.ok} tamam · ${ozet.uyari} uyarı · ${ozet.hata} hata${ozet.atla ? ` · ${ozet.atla} atlandı` : ""}\n`);
process.exit(ozet.hata ? 1 : 0);
