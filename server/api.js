import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bildirilir } from "./bildirim.js";
import { doktor } from "./doktor.js";
import { saglikGecmisi } from "./gecmis.js";
import { cerezOku, denemeSiniri, jetonCoz, jetonUret, parolaDogru } from "./kimlik.js";
import { olayDeposu, olaylariBul } from "./olaylar.js";
import { ortamOku } from "./ortam.js";
import { gunAnahtari, gunlukOzet, ozetZamaniMi, saatCoz } from "./ozet.js";
import { logIzleyici, pm2Listesi, yenidenBaslamaIzleyici } from "./pm2.js";
import { portalGirisi } from "./portalGiris.js";
import { atlasSurumu } from "./surum.js";
import { kisici, mesajMetni, telegramAyari, telegramGonder } from "./telegram.js";
import { adimIsaretle, manifestOku, MANIFEST_YOLU, topla } from "./topla.js";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERI = join(KOK, "data");
const DENETIM_ARALIK_MS = 30 * 60_000;
const CEREZ = "atlas_oturum";
const YEREL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
const PM2_ARALIK_MS = 10_000;
const LOG_ARALIK_MS = 2_000;

function json(res, kod, veri, ekBasliklar = {}) {
  res.writeHead(kod, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...ekBasliklar });
  res.end(JSON.stringify(veri));
}

async function govdeOku(req) {
  let ham = "";
  for await (const parca of req) {
    ham += parca;
    if (ham.length > 10_000) throw new Error("gövde çok büyük");
  }
  return ham ? JSON.parse(ham) : {};
}

const hostAdi = (req) => (req.headers.host ?? "").toLowerCase();

/**
 * Uzak istek = Cloudflare üzerinden gelen (cf-connecting-ip başlığını istemci silemez),
 * yerel olmayan Host ya da loopback dışı soket. Uzak istek her zaman parola ister.
 */
export function uzakMi(req) {
  const soket = req.socket?.remoteAddress ?? "";
  const loopback = soket === "127.0.0.1" || soket === "::1" || soket === "::ffff:127.0.0.1";
  return Boolean(req.headers["cf-connecting-ip"]) || !YEREL_HOST.test(hostAdi(req)) || !loopback;
}

/** Host izinli listede mi; yazma isteği aynı kökenden ve özel başlıkla mı (CSRF/DNS rebinding). */
export function istekUygun(req, izinliHost) {
  const host = hostAdi(req);
  if (!YEREL_HOST.test(host) && host !== izinliHost) return false;
  if (req.method === "GET") return true;
  if (req.headers["x-atlas"] !== "1") return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/**
 * API:
 *   GET  /api/oturum   { girisGerekli, girisli }          (herkese açık)
 *   POST /api/giris    { parola }                          (herkese açık, deneme sınırlı)
 *   POST /api/cikis
 *   GET  /api/durum    son anlık görüntü
 *   GET  /api/akis     SSE: durum · log
 *   GET  /api/log?surec=ad   sürecin son log satırları
 *   POST /api/yenile   önbellekleri atlayıp hemen topla
 *   POST /api/adim     { id, tamam }
 *   POST /api/ac       { id } repo klasörünü VS Code'da aç (yalnız yerel ortam + yerel istek)
 *   GET  /api/surum    Atlas'ın çalışan commit'i, derleme işareti, açılış zamanı
 *   GET  /api/doktor   son kurulum denetimi · POST /api/doktor şimdi denetle
 */
export function apiOlustur(ayar = ortamOku()) {
  let son = null;
  let calisiyor = null;
  let manifestHatasi = null;
  const zamanlayicilar = [];
  let izleyici = null;
  const istemciler = new Set();
  const sinir = denemeSiniri();

  // — sürüm, olay günlüğü, erişilebilirlik geçmişi, kurulum denetimi —
  let atlasBilgi = null;
  let denetim = null;
  let denetleniyor = null;
  const olaylar = olayDeposu({ dosya: join(VERI, "olaylar.json") });
  const telegram = telegramAyari();
  const telegramKisici = kisici();

  /**
   * Günlük özet (isteğe bağlı): .env ATLAS_TELEGRAM_OZET=08:30 ve Telegram açıksa, her gün o saatten
   * sonraki ilk dakikada bir kez. Son gönderim günü data/ozet.json'da: yeniden başlatma iki kez göndermez.
   */
  function gunlukOzetiKur() {
    const hedef = saatCoz(process.env.ATLAS_TELEGRAM_OZET);
    if (!telegram || !hedef) return;
    const dosya = join(VERI, "ozet.json");
    let sonGonderilen;
    const kontrol = async () => {
      sonGonderilen ??= await readFile(dosya, "utf8").then((s) => JSON.parse(s).son ?? null).catch(() => null);
      if (!son || !ozetZamaniMi(hedef, sonGonderilen)) return;
      const bugun = gunAnahtari(new Date());
      sonGonderilen = bugun; // gönderim sürerken bir sonraki dakika tekrar denemesin
      try {
        await telegramGonder(telegram, gunlukOzet(son, { host: ayar.host }));
        await mkdir(VERI, { recursive: true });
        await writeFile(dosya, JSON.stringify({ son: bugun }), "utf8");
      } catch (e) {
        sonGonderilen = null; // bir dakika sonra yeniden dener
        console.error(`[atlas] günlük özet gönderilemedi: ${e.message}`);
      }
    };
    zamanlayicilar.push(setInterval(() => kontrol().catch(() => {}), 60_000));
  }

  /** Olayı günlüğe yazar; bildirilir olanlar (Telegram açıksa) tek mesajda gönderilir. */
  async function olayEkle(liste) {
    const eklenen = await olaylar.ekle(liste);
    const gidecek = eklenen.filter(bildirilir);
    if (telegram && gidecek.length && telegramKisici.izinli()) {
      const bastirilan = telegramKisici.bastirilaniAl();
      const ek = bastirilan ? `\n(${bastirilan} mesaj saatlik sınır yüzünden gönderilmedi)` : "";
      telegramGonder(telegram, mesajMetni(gidecek, { host: ayar.host }) + ek)
        .catch((e) => console.error(`[atlas] Telegram gönderilemedi: ${e.message}`));
    }
    return eklenen;
  }
  const saglikKaydi = saglikGecmisi({ dosya: join(VERI, "saglik-gecmisi.json") });

  async function denetle() {
    denetleniyor ??= (async () => {
      const onceki = denetim;
      try {
        denetim = await doktor({ ayar, manifest: await manifestOku(), kok: KOK });
      } catch (e) {
        denetim = { zaman: new Date().toISOString(), sonuclar: [{ ad: "Denetim", durum: "hata", mesaj: e.message }], ozet: { ok: 0, uyari: 0, hata: 1, atla: 0 } };
      }
      const once = onceki?.ozet.hata ?? 0;
      const simdi = denetim.ozet.hata;
      if (simdi > 0 && once === 0) await olayEkle([{ seviye: "hata", tur: "denetim", metin: `Kurulum denetimi ${simdi} sorun buldu` }]);
      if (simdi === 0 && once > 0) await olayEkle([{ seviye: "iyi", tur: "denetim", metin: "Kurulum denetimi temiz" }]);
      return denetim;
    })().finally(() => {
      denetleniyor = null;
    });
    return denetleniyor;
  }

  // — pm2 + log —
  let surecHam = null;
  const yenidenSay = yenidenBaslamaIzleyici();
  const loglar = logIzleyici({ yayinla: (veri) => yayinla("log", veri) });

  async function pm2Tazele() {
    surecHam = await pm2Listesi();
  }
  function surecOzeti() {
    if (!surecHam) return null;
    return surecHam.map((s) => ({
      ...s,
      sonSaatYenidenBaslama: yenidenSay(s.ad, s.yenidenBaslama),
      hata15: loglar.hataSayisi(s.ad),
    }));
  }

  function yayinla(olay, veri) {
    const satir = `event: ${olay}\ndata: ${JSON.stringify(veri)}\n\n`;
    for (const res of istemciler) res.write(satir);
  }

  async function yenile(secenek = {}) {
    if (calisiyor) return calisiyor;
    calisiyor = (async () => {
      try {
        if (secenek.zorla) await pm2Tazele();
        const yeni = await topla({ ...secenek, ayar, surecler: surecOzeti(), saglikKaydi, denetim });
        await olayEkle(olaylariBul(son, yeni));
        son = { ...yeni, atlas: atlasBilgi, denetim, olaylar: await olaylar.son(60), bildirimKanali: { telegram: Boolean(telegram) } };
        manifestHatasi = null;
      } catch (e) {
        manifestHatasi = `projeler.json okunamadı: ${e.message}`;
      }
      yayinla("durum", { ...son, manifestHatasi });
      return son;
    })().finally(() => {
      calisiyor = null;
    });
    return calisiyor;
  }

  let baslatma = null;
  function baslat() {
    baslatma ??= (async () => {
      let saniye = 20;
      try {
        saniye = (await manifestOku()).yenilemeSaniye ?? 20;
      } catch {
        // manifest bozuksa yenile() hatayı ekrana taşır
      }
      atlasBilgi = await atlasSurumu(KOK);
      gunlukOzetiKur();
      await olayEkle([{ seviye: "bilgi", tur: "atlas", metin: `Atlas başlatıldı (${atlasBilgi.commit ?? "sürüm bilinmiyor"} · ${ayar.ortam})` }]);
      // Denetim dışarıya istek atar; açılışı bekletmesin, bitince ekran tazelenir.
      denetle().then(() => yenile());
      zamanlayicilar.push(setInterval(() => denetle().then(() => yenile()), DENETIM_ARALIK_MS));
      await pm2Tazele();
      if (surecHam) {
        await loglar.tara(surecHam);
        zamanlayicilar.push(setInterval(pm2Tazele, PM2_ARALIK_MS));
        zamanlayicilar.push(setInterval(() => surecHam && loglar.tara(surecHam).catch(() => {}), LOG_ARALIK_MS));
      }
      zamanlayicilar.push(setInterval(() => yenile(), saniye * 1000));
      let bekleyen = null;
      // Klasör izlenir: bazı editörler dosyayı silip yeniden yazar, dosya izleyicisi kopar.
      izleyici = watch(dirname(MANIFEST_YOLU), (_olay, ad) => {
        if (ad && ad !== basename(MANIFEST_YOLU)) return;
        clearTimeout(bekleyen);
        bekleyen = setTimeout(() => yenile(), 300);
      });
      await yenile();
    })();
    return baslatma;
  }

  // — oturum —
  const oturumSn = ayar.oturumGun * 86_400;
  function girisli(req) {
    return Boolean(jetonCoz(cerezOku(req.headers.cookie, CEREZ), ayar.oturumSirri));
  }
  function cerez(deger, maxAge, uzak) {
    return `${CEREZ}=${deger}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${uzak ? "; Secure" : ""}`;
  }
  const istemciIp = (req) => req.headers["cf-connecting-ip"] ?? req.socket?.remoteAddress ?? "?";

  async function isle(req, res, next) {
    const url = new URL(req.url, "http://yerel");
    if (!url.pathname.startsWith("/api/")) return next();
    const yol = url.pathname;
    try {
      if (!istekUygun(req, ayar.host)) return json(res, 403, { hata: "İstek reddedildi (köken/başlık)." });
      const uzak = uzakMi(req);
      const girisGerekli = uzak;
      // Portal kipi önceliklidir: parola Rosbel portalındaki izinli kullanıcınınkidir.
      const girisTuru = ayar.portalEposta ? "portal" : "parola";
      const kimlikHazir = Boolean(
        (ayar.portalEposta || ayar.parolaOzeti) && ayar.oturumSirri && ayar.oturumSirri.length >= 32,
      );

      if (req.method === "GET" && yol === "/api/oturum") {
        return json(res, 200, { girisGerekli, girisli: !girisGerekli || girisli(req), kimlikHazir, girisTuru });
      }
      if (req.method === "POST" && yol === "/api/giris") {
        if (!kimlikHazir) return json(res, 503, { hata: "Sunucuda giriş ayarlanmamış (ATLAS_PORTAL_EPOSTA ya da ATLAS_PAROLA_HASH, ve ATLAS_OTURUM_SIRRI)." });
        const ip = istemciIp(req);
        // Atlas'ın kendi sınırı portala gitmeden önce uygulanır: portal kaba kuvvete aracılık etmez.
        if (!sinir.izinli(ip)) return json(res, 429, { hata: "Çok fazla deneme. Biraz sonra tekrar dene." });
        const { parola } = await govdeOku(req);
        if (typeof parola !== "string" || !parola) return json(res, 400, { hata: "Parola boş olamaz." });
        let dogru;
        if (girisTuru === "portal") {
          const sonuc = await portalGirisi({ url: ayar.portalGirisUrl, eposta: ayar.portalEposta, parola });
          if (!sonuc.ok && sonuc.neden === "portal") {
            console.error(`[atlas] portal giriş ucu yanıt vermedi (${sonuc.kod})`);
            return json(res, 502, { hata: "Portal şu an doğrulama yapamıyor. Biraz sonra tekrar dene." });
          }
          dogru = sonuc.ok;
        } else {
          dogru = await parolaDogru(parola, ayar.parolaOzeti);
        }
        if (!dogru) {
          sinir.basarisiz(ip);
          console.warn(`[atlas] başarısız giriş: ${ip}`);
          return json(res, 401, { hata: "Parola yanlış." });
        }
        sinir.basarili(ip);
        console.log(`[atlas] giriş: ${ip}`);
        return json(res, 200, { ok: true }, { "set-cookie": cerez(jetonUret(ayar.oturumSirri, oturumSn), oturumSn, uzak) });
      }
      if (req.method === "POST" && yol === "/api/cikis") {
        return json(res, 200, { ok: true }, { "set-cookie": cerez("", 0, uzak) });
      }

      if (girisGerekli) {
        if (!kimlikHazir) return json(res, 503, { hata: "Uzak erişim için sunucuda giriş ayarlanmamış." });
        if (!girisli(req)) return json(res, 401, { hata: "Oturum gerekli." });
      }
      await baslat();

      if (req.method === "GET" && yol === "/api/durum") {
        return json(res, 200, { ...(son ?? (await yenile())), manifestHatasi });
      }
      if (req.method === "GET" && yol === "/api/akis") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
        res.write(": bagli\n\n");
        istemciler.add(res);
        if (son) res.write(`event: durum\ndata: ${JSON.stringify({ ...son, manifestHatasi })}\n\n`);
        const nabiz = setInterval(() => res.write(": nabiz\n\n"), 25000);
        req.on("close", () => {
          clearInterval(nabiz);
          istemciler.delete(res);
        });
        return;
      }
      if (req.method === "GET" && yol === "/api/log") {
        const ad = url.searchParams.get("surec") ?? "";
        if (!surecHam?.some((s) => s.ad === ad)) return json(res, 404, { hata: "Süreç bulunamadı." });
        return json(res, 200, { surec: ad, satirlar: loglar.satirlar(ad) });
      }
      if (req.method === "POST" && yol === "/api/yenile") {
        return json(res, 200, await yenile({ zorla: true }));
      }
      if (req.method === "POST" && yol === "/api/adim") {
        const { id, tamam } = await govdeOku(req);
        if (typeof id !== "string" || !id.includes(":")) return json(res, 400, { hata: "Geçersiz adım." });
        await adimIsaretle(id, Boolean(tamam));
        await yenile();
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && yol === "/api/ac") {
        if (ayar.ortam !== "yerel" || uzak) return json(res, 403, { hata: "Yalnız yerel kullanımda açılır." });
        const { id } = await govdeOku(req);
        const proje = (await manifestOku()).projeler.find((p) => p.id === id);
        if (!proje?.repo) return json(res, 404, { hata: "Projenin repo yolu yok." });
        // Yol kullanıcıdan değil manifestten gelir; yine de kabuğa tırnaklı verilir.
        spawn("code", [`"${proje.repo}"`], { shell: true, detached: true, stdio: "ignore", windowsHide: true }).unref();
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && yol === "/api/bildirim-dene") {
        if (!telegram) return json(res, 400, { hata: "Telegram ayarlı değil (.env ATLAS_TELEGRAM_TOKEN + ATLAS_TELEGRAM_SOHBET)." });
        try {
          await telegramGonder(telegram, mesajMetni([{ seviye: "iyi", metin: "Deneme bildirimi — Atlas buraya yazabiliyor." }], { host: ayar.host }));
          return json(res, 200, { ok: true });
        } catch (e) {
          return json(res, 502, { hata: e.message });
        }
      }
      if (req.method === "GET" && yol === "/api/surum") {
        return json(res, 200, atlasBilgi);
      }
      if (yol === "/api/doktor" && (req.method === "GET" || req.method === "POST")) {
        const sonuc = req.method === "POST" || !denetim ? await denetle() : denetim;
        if (req.method === "POST") yenile();
        return json(res, 200, sonuc);
      }
      return json(res, 404, { hata: "Bulunamadı." });
    } catch (e) {
      return json(res, 500, { hata: e.message });
    }
  }

  function durdur() {
    for (const z of zamanlayicilar) clearInterval(z);
    izleyici?.close();
    for (const res of istemciler) res.end();
    istemciler.clear();
  }

  return { isle, durdur, yenile, baslat };
}
