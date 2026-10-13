// Saf yardımcılar: ham veriden uyarı, durum, akış ve hafta özetini türetir.
// DB/ağ/dosya erişimi yok — birim testle korunur (test/turet.test.js).

export const YAVAS_MS = 3000;

// Commit tarihleri zaman olarak sıralanır: git %cI committer'ın dilimini yazar, metin sırası yanıltır.
const yenidenEskiye = (a, b) => Date.parse(b.tarih) - Date.parse(a.tarih);
export const HATA_ESIGI = 10;

/**
 * Elle yazılan + git + sağlık + pm2 kaynaklı uyarılar.
 * ek.ortam: "yerel" (PC) | "sunucu" — aynı git durumu iki yerde farklı anlam taşır.
 * ek.surecler: [{ ad, durum, sonSaatYenidenBaslama, hata15 }]
 */
export function uyarilariUret(proje, git, saglik, ek = {}) {
  const sunucu = ek.ortam === "sunucu";
  // Elle uyarı düz metin ya da { metin, tarih, seviye } olabilir; tarih notun ne zamandır durduğunu gösterir.
  const liste = (proje.uyarilar ?? [])
    .map((u) => (typeof u === "string" ? { metin: u } : u ?? {}))
    .filter((u) => u.metin)
    .map((u) => ({ metin: u.metin, kaynak: "elle", seviye: u.seviye === "yuksek" ? "yuksek" : "orta", ...(u.tarih ? { tarih: u.tarih } : {}) }));
  if (git && !git.var) {
    if (git.kaynak === "github") liste.push({ metin: `GitHub okunamadı (${git.hata})`, kaynak: "git", seviye: "orta" });
    else liste.push({ metin: `Repo okunamadı: ${proje.repo}`, kaynak: "git", seviye: "yuksek" });
  }
  if (git?.var) {
    if (git.degisen > 0) {
      liste.push({ metin: sunucu ? `Sunucuda ${git.degisen} dosyada commit edilmemiş değişiklik var` : `${git.degisen} dosya commit edilmedi`, kaynak: "git", seviye: "orta" });
    }
    if (git.ileride > 0) {
      liste.push({ metin: sunucu ? `Sunucuda push edilmemiş ${git.ileride} commit var` : `${git.ileride} commit push edilmedi (${git.dal})`, kaynak: "git", seviye: "orta" });
    }
    if (git.geride > 0) {
      liste.push({ metin: sunucu ? `${git.geride} commit canlıya alınmadı` : `${git.geride} commit çekilmedi (git pull)`, kaynak: "git", seviye: "orta" });
    }
  }
  for (const s of ek.surecler ?? []) {
    if (s.durum !== "online") liste.push({ metin: `${s.ad} çalışmıyor (${s.durum})`, kaynak: "pm2", seviye: "yuksek" });
    if (s.sonSaatYenidenBaslama > 0) liste.push({ metin: `${s.ad} son 1 saatte ${s.sonSaatYenidenBaslama} kez yeniden başladı`, kaynak: "pm2", seviye: "orta" });
    if (s.hata15 >= HATA_ESIGI) liste.push({ metin: `${s.ad}: son 15 dk'da ${s.hata15} hata satırı`, kaynak: "pm2", seviye: "orta" });
  }
  if (saglik) {
    if (!saglik.ok) {
      liste.push({ metin: `Site yanıt vermiyor (${saglik.kod ?? saglik.hata})`, kaynak: "saglik", seviye: "yuksek" });
    } else if (saglik.ms > YAVAS_MS) {
      liste.push({ metin: `Site yavaş yanıt veriyor (${saglik.ms} ms)`, kaynak: "saglik", seviye: "orta" });
    }
  }
  return liste;
}

const ASAMA_DURUM = { canli: "live", gelistirme: "dev", bekliyor: "warn", fikir: "idle", beklemede: "idle" };
export const ASAMA_SIRA = { fikir: 1, gelistirme: 2, bekliyor: 3, canli: 4, beklemede: 4 };

/** Haritadaki renk: aşamadan gelir; yüksek seviyeli uyarı (site çöktü, repo yok) kırmızıya çeker. */
export function durumBul(asama, uyarilar) {
  if (uyarilar.some((u) => u.seviye === "yuksek")) return "warn";
  return ASAMA_DURUM[asama] ?? "idle";
}

/**
 * Projelerin commit listelerini tek akışta birleştirir. Aynı commit birden çok
 * projede görünürse (ör. Rosbel geneli + Mutabakat modülü) en dar kapsamlıya yazılır.
 */
export function akisiBirlestir(projeler, sinir = 40) {
  const secilen = new Map();
  for (const p of projeler) {
    const oncelik = p.kapsam?.length ? 2 : 1;
    for (const c of p.git?.commitler ?? []) {
      const onceki = secilen.get(c.hash);
      if (!onceki || oncelik > onceki.oncelik) {
        secilen.set(c.hash, { ...c, projeId: p.id, oncelik });
      }
    }
  }
  return [...secilen.values()]
    .sort(yenidenEskiye)
    .slice(0, sinir)
    .map(({ oncelik: _o, ...c }) => c);
}

/**
 * Yayın adımları: bekleyen dosyalar manifestteki kurallarla eşlenir (kural sırası = uygulama sırası).
 * kural: { yol: "backend/migrations/", adim: "cd backend; npm run migrate", not? }
 *   yol "" → her değişiklikte (ör. git pull); "/" ile biten → klasör öneki; diğerleri → tam dosya ya da o klasör.
 * Eşleşmeyen kural listeye girmez.
 */
export function yayinAdimlari(dosyalar, kurallar = []) {
  const adimlar = [];
  for (const k of kurallar) {
    if (typeof k?.adim !== "string") continue;
    const yol = k.yol ?? "";
    const eslesir = (d) => (yol.endsWith("/") ? d.startsWith(yol) : d === yol || d.startsWith(`${yol}/`));
    const eslesen = yol === "" ? dosyalar : dosyalar.filter(eslesir);
    if (!eslesen.length) continue;
    // Aynı komut iki kuraldan gelirse bir kez yazılır (dosya sayıları birleşir).
    const onceki = adimlar.find((a) => a.adim === k.adim);
    if (onceki) {
      onceki.dosya += eslesen.length;
      continue;
    }
    adimlar.push({ adim: k.adim, ...(k.not ? { not: k.not } : {}), ...(k.bilgi ? { bilgi: true } : {}), dosya: eslesen.length, ornek: eslesen.slice(0, 3) });
  }
  return adimlar;
}

/**
 * Ekrana giden akış: genel son `genel` commit + her projenin kendi son `projeBasi` commit'i.
 * Yalnız genel sınır olsaydı az commit alan modülün detayı "commit yok" derdi.
 */
export function akisSec(tumAkis, projeIdleri, { genel = 40, projeBasi = 4 } = {}) {
  const secilen = new Map(tumAkis.slice(0, genel).map((c) => [c.hash, c]));
  for (const id of projeIdleri) {
    for (const c of tumAkis.filter((x) => x.projeId === id).slice(0, projeBasi)) secilen.set(c.hash, c);
  }
  return [...secilen.values()].sort(yenidenEskiye);
}

const GUN_ADLARI =["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function yerelGunAnahtari(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Son 7 günün (bugün dahil) commit sayısı, eskiden yeniye. */
export function haftalikOzet(akis, simdi = new Date()) {
  const sayac = new Map();
  for (const c of akis) {
    const k = yerelGunAnahtari(new Date(c.tarih));
    sayac.set(k, (sayac.get(k) ?? 0) + 1);
  }
  const gunler = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() - i);
    const k = yerelGunAnahtari(d);
    gunler.push({ tarih: k, gun: GUN_ADLARI[d.getDay()], sayi: sayac.get(k) ?? 0, bugun: i === 0 });
  }
  return gunler;
}
