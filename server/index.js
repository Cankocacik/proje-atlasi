// Üretim sunucusu: derlenmiş arayüzü (dist/) ve API'yi tek süreçte sunar.
// Yalnız 127.0.0.1'e bağlanır — dışarıya Cloudflare Tunnel üzerinden açılır.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Gizli ayarlar (parola özeti, oturum sırrı, GitHub token) .env'de durur; repoya girmez.
if (existsSync(join(KOK, ".env"))) process.loadEnvFile(join(KOK, ".env"));

const { apiOlustur } = await import("./api.js");
const { ortamOku } = await import("./ortam.js");

const DIST = join(KOK, "dist");
const PORT = Number(process.env.PORT ?? 4321);
const TURLER = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

const GUVENLIK = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

const ayar = ortamOku();
const api = apiOlustur(ayar);

async function statikSun(req, res) {
  const yol = decodeURIComponent(new URL(req.url, "http://yerel").pathname);
  let dosya = normalize(join(DIST, yol));
  if (!dosya.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(dosya)).isDirectory()) dosya = join(dosya, "index.html");
  } catch {
    dosya = join(DIST, "index.html");
  }
  try {
    const icerik = await readFile(dosya);
    const onbellek = dosya.includes(`${join("dist", "assets")}`) ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": TURLER[extname(dosya)] ?? "application/octet-stream", "cache-control": onbellek });
    res.end(icerik);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("Arayüz derlenmemiş: önce `npm run build` çalıştır.");
  }
}

createServer((req, res) => {
  for (const [ad, deger] of Object.entries(GUVENLIK)) res.setHeader(ad, deger);
  api.isle(req, res, () => statikSun(req, res));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Proje Atlası (${ayar.ortam}) → http://127.0.0.1:${PORT}${ayar.host ? ` · dış adres: https://${ayar.host}` : ""}`);
  // İzleme açılışta başlar: kimse sayfayı açmasa da olay günlüğü, erişim geçmişi ve log sayaçları işler.
  api.baslat().catch((e) => console.error(`[atlas] izleme başlatılamadı: ${e.message}`));
  if (ayar.host && !ayar.portalEposta && !ayar.parolaOzeti) console.warn("[atlas] UYARI: giriş ayarı yok — dışarıdan giriş kapalı kalır.");
  if (ayar.portalEposta) console.log(`[atlas] giriş: portal kullanıcısı (${ayar.portalGirisUrl})`);
});
