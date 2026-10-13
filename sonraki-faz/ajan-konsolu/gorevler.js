import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { basliksizKomut, claudeSatiri, codexSatiri, satirTamponu, terminalArgumanlari } from "./ajan.js";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KAYIT = resolve(KOK, "data", "gorevler.json");
const AYNI_ANDA = 3;
const SAKLANAN = 40;
const OLAY_SINIRI = 1500;

/** Çalışan görev listesi. Olaylar `yayinla(olayAdi, veri)` ile SSE'ye gider. */
export function gorevYoneticisi(yayinla) {
  const gorevler = new Map();
  const surecler = new Map();
  let yuklendi = null;

  function yukle() {
    yuklendi ??= readFile(KAYIT, "utf8")
      .then((ham) => {
        for (const g of JSON.parse(ham)) {
          // Sunucu kapanırken yarım kalanlar "yarıda kaldı" olarak döner.
          if (g.durum === "calisiyor") g.durum = "yarida";
          gorevler.set(g.id, g);
        }
      })
      .catch(() => {});
    return yuklendi;
  }

  let kayitBekliyor = null;
  function kaydet() {
    clearTimeout(kayitBekliyor);
    kayitBekliyor = setTimeout(async () => {
      const liste = [...gorevler.values()].sort((a, b) => (a.baslangic < b.baslangic ? 1 : -1)).slice(0, SAKLANAN);
      await mkdir(dirname(KAYIT), { recursive: true });
      await writeFile(KAYIT, JSON.stringify(liste), "utf8");
    }, 500);
  }

  const ozet = ({ olaylar, ...g }) => ({ ...g, olaySayisi: olaylar.length });

  function olayEkle(g, olay) {
    const kayit = { ...olay, zaman: new Date().toISOString() };
    g.olaylar.push(kayit);
    if (g.olaylar.length > OLAY_SINIRI) g.olaylar.splice(0, g.olaylar.length - OLAY_SINIRI);
    yayinla("gorev-olay", { id: g.id, olay: kayit });
  }

  function guncelle(g) {
    yayinla("gorev", ozet(g));
    kaydet();
  }

  async function baslat({ ajan, yetki, istem, proje, oturum }) {
    await yukle();
    const calisan = [...gorevler.values()].filter((g) => g.durum === "calisiyor").length;
    if (calisan >= AYNI_ANDA) throw new Error(`Aynı anda en çok ${AYNI_ANDA} görev çalışır.`);
    const { komut, args } = basliksizKomut({ ajan, yetki, oturum });

    const g = {
      id: randomUUID(),
      ajan, yetki, istem,
      projeId: proje.id, projeAd: proje.ad, repo: proje.repo,
      durum: "calisiyor",
      baslangic: new Date().toISOString(),
      bitis: null, oturum: oturum ?? null, sonuc: null, olaylar: [],
    };
    gorevler.set(g.id, g);
    olayEkle(g, { tur: "istem", metin: istem });

    const surec = spawn(komut, args, { cwd: proje.repo, windowsHide: true, env: { ...process.env, FORCE_COLOR: "0" } });
    surecler.set(g.id, surec);
    const ayristir = ajan === "claude" ? claudeSatiri : codexSatiri;
    let sonMesaj = "";

    const tampon = satirTamponu((satir) => {
      let o;
      try {
        o = JSON.parse(satir);
      } catch {
        olayEkle(g, { tur: "log", metin: satir.slice(0, 1000) });
        return;
      }
      const c = ayristir(o);
      if (c.oturum) g.oturum = c.oturum;
      if (c.sonMesaj) sonMesaj = c.sonMesaj;
      if (c.sonuc) g.sonuc = { ...c.sonuc, metin: c.sonuc.metin || sonMesaj };
      for (const olay of c.olaylar) olayEkle(g, olay);
    });
    const hataTamponu = satirTamponu((satir) => olayEkle(g, { tur: "log", metin: satir.slice(0, 1000) }));

    surec.stdout.setEncoding("utf8").on("data", (p) => tampon.ekle(p));
    surec.stderr.setEncoding("utf8").on("data", (p) => hataTamponu.ekle(p));
    surec.on("error", (e) => {
      olayEkle(g, { tur: "hata", metin: `Başlatılamadı: ${e.message}` });
    });
    surec.on("close", (kod) => {
      tampon.bitir();
      hataTamponu.bitir();
      surecler.delete(g.id);
      g.bitis = new Date().toISOString();
      if (g.durum === "durduruluyor") g.durum = "durduruldu";
      else if (kod === 0 && !g.sonuc?.hata) g.durum = "bitti";
      else g.durum = "hata";
      if (g.durum === "hata" && kod !== 0) olayEkle(g, { tur: "hata", metin: `Süreç ${kod} koduyla çıktı.` });
      guncelle(g);
    });

    surec.stdin.end(istem, "utf8");
    guncelle(g);
    return ozet(g);
  }

  function durdur(id) {
    const surec = surecler.get(id);
    const g = gorevler.get(id);
    if (!surec || !g) return false;
    g.durum = "durduruluyor";
    guncelle(g);
    // Windows'ta alt süreçler (araç komutları) de kapansın diye ağaç olarak öldürülür.
    if (process.platform === "win32") execFile("taskkill", ["/pid", String(surec.pid), "/T", "/F"], () => {});
    else surec.kill("SIGTERM");
    return true;
  }

  function terminaldeAc({ ajan, proje, istem, oturum }) {
    const args = terminalArgumanlari({ ajan, repo: proje.repo, baslik: `${proje.ad} · ${ajan === "claude" ? "Claude" : "Codex"}`, istem, oturum });
    spawn("wt", args, { detached: true, stdio: "ignore", windowsHide: false }).unref();
  }

  async function liste() {
    await yukle();
    return [...gorevler.values()].sort((a, b) => (a.baslangic < b.baslangic ? 1 : -1)).slice(0, SAKLANAN).map(ozet);
  }

  async function getir(id) {
    await yukle();
    return gorevler.get(id) ?? null;
  }

  function hepsiniDurdur() {
    for (const id of surecler.keys()) durdur(id);
  }

  return { baslat, durdur, terminaldeAc, liste, getir, hepsiniDurdur };
}
