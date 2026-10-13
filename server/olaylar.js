// Olay günlüğü: ardışık iki anlık görüntü arasındaki DURUM DEĞİŞİMLERİNİ kaydeder
// (site düştü/kalktı, süreç durdu/yeniden başladı, yeni commit, canlıya alındı).
// Sürekli var olan durum değil, değişim yazılır — böylece günlük gürültüsüz kalır.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Saf: önceki → şimdiki anlık görüntüden olay listesi (zaman/kimlik eklenmemiş). */
export function olaylariBul(onceki, simdiki) {
  if (!onceki?.projeler || !simdiki?.projeler) return [];
  const olaylar = [];
  const oncekiP = new Map(onceki.projeler.map((p) => [p.id, p]));

  for (const p of simdiki.projeler) {
    const o = oncekiP.get(p.id);
    if (!o) continue;

    if (o.saglik && p.saglik && o.saglik.ok !== p.saglik.ok) {
      olaylar.push(p.saglik.ok
        ? { seviye: "iyi", tur: "site", projeId: p.id, metin: `${p.ad}: site yeniden yanıt veriyor (${p.saglik.kod})` }
        : { seviye: "hata", tur: "site", projeId: p.id, metin: `${p.ad}: site yanıt vermiyor (${p.saglik.kod ?? p.saglik.hata})` });
    }

    // Commit/yayın olayları yalnız repo düzeyindeki projelerde (modüller aynı commit'i tekrar etmesin).
    if (p.kapsam?.length) continue;
    const oSon = o.git?.son;
    const pSon = p.git?.son;
    if (oSon && pSon && oSon.hash !== pSon.hash && pSon.tarih > oSon.tarih) {
      olaylar.push({ seviye: "bilgi", tur: "commit", projeId: p.id, metin: `${p.ad}: yeni commit — ${pSon.mesaj} (${pSon.kisa})` });
    }
    if (simdiki.ortam === "sunucu" && o.git?.canlida && p.git?.canlida && o.git.canlida !== p.git.canlida) {
      olaylar.push({ seviye: "iyi", tur: "yayin", projeId: p.id, metin: `${p.ad} canlıya alındı: ${o.git.canlida} → ${p.git.canlida}` });
    }
  }

  const sahibi = (ad) => simdiki.projeler.find((p) => p.surecler?.includes(ad))?.id;
  const oncekiS = new Map((onceki.surecler ?? []).map((s) => [s.ad, s]));
  for (const s of simdiki.surecler ?? []) {
    const o = oncekiS.get(s.ad);
    if (!o) {
      if (onceki.surecler) olaylar.push({ seviye: "bilgi", tur: "surec", projeId: sahibi(s.ad), metin: `${s.ad} pm2'ye eklendi` });
      continue;
    }
    if (o.durum !== s.durum) {
      olaylar.push(s.durum === "online"
        ? { seviye: "iyi", tur: "surec", projeId: sahibi(s.ad), metin: `${s.ad} yeniden çalışıyor` }
        : { seviye: "hata", tur: "surec", projeId: sahibi(s.ad), metin: `${s.ad} durdu (${s.durum})` });
    } else if (s.yenidenBaslama > o.yenidenBaslama) {
      olaylar.push({ seviye: "uyari", tur: "surec", projeId: sahibi(s.ad), metin: `${s.ad} yeniden başladı (↻ ${s.yenidenBaslama})` });
    }
  }
  for (const o of onceki.surecler ?? []) {
    if (simdiki.surecler && !simdiki.surecler.some((s) => s.ad === o.ad)) {
      olaylar.push({ seviye: "hata", tur: "surec", projeId: sahibi(o.ad), metin: `${o.ad} pm2 listesinden çıktı` });
    }
  }
  return olaylar;
}

/** Kalıcı olay deposu (data/olaylar.json, son `sinir` olay). */
export function olayDeposu({ dosya, sinir = 300 }) {
  let liste = [];
  let sayac = 0;
  let yuklendi = null;
  let bekleyen = null;

  function yukle() {
    yuklendi ??= readFile(dosya, "utf8")
      .then((ham) => {
        liste = JSON.parse(ham);
        sayac = liste.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0);
      })
      .catch(() => {});
    return yuklendi;
  }

  function kaydet() {
    clearTimeout(bekleyen);
    bekleyen = setTimeout(async () => {
      await mkdir(dirname(dosya), { recursive: true }).catch(() => {});
      await writeFile(dosya, JSON.stringify(liste), "utf8").catch(() => {});
    }, 1000);
  }

  async function ekle(yeniler, zaman = new Date()) {
    await yukle();
    if (!yeniler.length) return [];
    const eklenen = yeniler.map((o) => ({ id: ++sayac, zaman: zaman.toISOString(), ...o }));
    liste = [...eklenen.reverse(), ...liste].slice(0, sinir);
    kaydet();
    return eklenen;
  }

  async function son(n = 60) {
    await yukle();
    return liste.slice(0, n);
  }

  return { ekle, son };
}
