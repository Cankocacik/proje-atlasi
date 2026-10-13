// Site erişilebilirlik geçmişi: her sağlık yoklaması saklanır, son 24 saat
// 30'ar dakikalık kutulara bölünerek "durum sayfası" şeridi üretilir.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const GUN_MS = 24 * 60 * 60_000;
export const KUTU_MS = 30 * 60_000;

/**
 * Saf: örnekleri (eskiden yeniye ya da karışık) kutulara böler.
 * kutu: "ok" (hepsi başarılı) | "kismi" (bazısı düştü) | "hata" (hiçbiri) | null (veri yok)
 */
export function kutula(ornekler, simdi = Date.now(), { kutuSayisi = 48, kutuMs = KUTU_MS } = {}) {
  const bas = simdi - kutuSayisi * kutuMs;
  const kutular = Array.from({ length: kutuSayisi }, () => ({ ok: 0, hata: 0 }));
  let toplam = 0;
  let basarili = 0;
  let msToplam = 0;
  let msSayi = 0;
  for (const o of ornekler) {
    if (o.t < bas || o.t > simdi) continue;
    const i = Math.min(kutuSayisi - 1, Math.floor((o.t - bas) / kutuMs));
    kutular[i][o.ok ? "ok" : "hata"]++;
    toplam++;
    if (o.ok) {
      basarili++;
      if (typeof o.ms === "number") {
        msToplam += o.ms;
        msSayi++;
      }
    }
  }
  return {
    yuzde: toplam ? Math.round((basarili / toplam) * 1000) / 10 : null,
    ortalamaMs: msSayi ? Math.round(msToplam / msSayi) : null,
    ornek: toplam,
    kutular: kutular.map((k) => (k.ok + k.hata === 0 ? null : k.hata === 0 ? "ok" : k.ok === 0 ? "hata" : "kismi")),
  };
}

/** Bellekte + diskte (data/saglik-gecmisi.json) tutulan yoklama kayıtları. */
export function saglikGecmisi({ dosya, saklaMs = GUN_MS }) {
  const kayit = new Map();
  let yuklendi = null;
  let bekleyen = null;

  function yukle() {
    yuklendi ??= readFile(dosya, "utf8")
      .then((ham) => {
        for (const [url, liste] of Object.entries(JSON.parse(ham))) kayit.set(url, liste);
      })
      .catch(() => {});
    return yuklendi;
  }

  function kaydet() {
    // Disk yazımı seyrek: yoklama dakikada bir, yazım en çok 5 dakikada bir.
    // (Erteleme değil kısma: her yoklamada sayaç sıfırlansaydı yazım hiç gerçekleşmezdi.)
    if (bekleyen) return;
    bekleyen = setTimeout(async () => {
      bekleyen = null;
      await mkdir(dirname(dosya), { recursive: true }).catch(() => {});
      await writeFile(dosya, JSON.stringify(Object.fromEntries(kayit)), "utf8").catch(() => {});
    }, 5 * 60_000);
    bekleyen.unref?.();
  }

  async function ekle(url, sonuc, t = Date.now()) {
    await yukle();
    const liste = (kayit.get(url) ?? []).filter((o) => t - o.t < saklaMs);
    liste.push({ t, ok: Boolean(sonuc.ok), ms: sonuc.ms ?? null });
    kayit.set(url, liste);
    kaydet();
  }

  async function ozet(url, simdi = Date.now()) {
    await yukle();
    return kutula(kayit.get(url) ?? [], simdi);
  }

  return { ekle, ozet, yukle };
}
