// Parola + imzalı oturum çerezi + deneme sınırı. Saf/bağımsız; test/kimlik.test.js.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptP = (parola, tuz, uzunluk) =>
  new Promise((ok, red) => scrypt(parola, tuz, uzunluk, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? red(e) : ok(k))));

/** `scrypt$<tuz>$<özet>` (base64url). */
export async function parolaOzeti(parola) {
  const tuz = randomBytes(16);
  const ozet = await scryptP(parola, tuz, 64);
  return `scrypt$${tuz.toString("base64url")}$${ozet.toString("base64url")}`;
}

export async function parolaDogru(parola, kayit) {
  if (typeof parola !== "string" || !parola || typeof kayit !== "string") return false;
  const [tur, tuz, ozet] = kayit.split("$");
  if (tur !== "scrypt" || !tuz || !ozet) return false;
  const beklenen = Buffer.from(ozet, "base64url");
  const gelen = await scryptP(parola, Buffer.from(tuz, "base64url"), beklenen.length);
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}

const imza = (veri, sir) => createHmac("sha256", sir).update(veri).digest("base64url");

/** Durumsuz oturum jetonu: base64url(JSON{exp,sid}).imza */
export function jetonUret(sir, sureSn, simdi = Date.now()) {
  const govde = Buffer.from(JSON.stringify({ exp: Math.floor(simdi / 1000) + sureSn, sid: randomBytes(9).toString("base64url") })).toString("base64url");
  return `${govde}.${imza(govde, sir)}`;
}

export function jetonCoz(jeton, sir, simdi = Date.now()) {
  if (typeof jeton !== "string" || !sir) return null;
  const [govde, gelenImza] = jeton.split(".");
  if (!govde || !gelenImza) return null;
  const a = Buffer.from(gelenImza);
  const b = Buffer.from(imza(govde, sir));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const veri = JSON.parse(Buffer.from(govde, "base64url").toString("utf8"));
    return typeof veri.exp === "number" && veri.exp * 1000 > simdi ? veri : null;
  } catch {
    return null;
  }
}

export function cerezOku(baslik, ad) {
  for (const parca of (baslik ?? "").split(";")) {
    const i = parca.indexOf("=");
    if (i > 0 && parca.slice(0, i).trim() === ad) return decodeURIComponent(parca.slice(i + 1).trim());
  }
  return null;
}

/**
 * Kaba kuvvete karşı: IP başına 15 dk'da 5, toplamda saatte 30 başarısız deneme.
 * Sınır dolunca doğru parola da reddedilir (süre bitene kadar).
 */
export function denemeSiniri({ ipSinir = 5, ipPencereMs = 15 * 60_000, genelSinir = 30, genelPencereMs = 60 * 60_000 } = {}) {
  const ipler = new Map();
  let genel = [];
  const temizle = (liste, pencere, simdi) => liste.filter((t) => simdi - t < pencere);
  return {
    izinli(ip, simdi = Date.now()) {
      genel = temizle(genel, genelPencereMs, simdi);
      const l = temizle(ipler.get(ip) ?? [], ipPencereMs, simdi);
      ipler.set(ip, l);
      return l.length < ipSinir && genel.length < genelSinir;
    },
    basarisiz(ip, simdi = Date.now()) {
      ipler.set(ip, [...(ipler.get(ip) ?? []), simdi]);
      genel.push(simdi);
    },
    basarili(ip) {
      ipler.delete(ip);
    },
  };
}
