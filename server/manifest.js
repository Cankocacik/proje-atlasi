// projeler.json elle düzenlenir: yazım hatası sessizce yanlış ekran üretmesin diye denetlenir.
// Saf; test/manifest.test.js. Sonuç: [{ seviye: "hata" | "uyari", yer, mesaj }]
import { loopbackMi } from "./icSaglik.js";
import { kutuBul } from "./kutu.js";

export const ASAMALAR = ["fikir", "gelistirme", "bekliyor", "canli", "beklemede"];
export const IKONLAR = ["hub", "product", "tool", "client", "module"];
export const ESKI_NOT_GUN = 21;

// JSON'da "C:\backend" hata vermez: \b sessizce backspace olur. Yolda kontrol karakteri = bozuk kaçış.
// eslint-disable-next-line no-control-regex
const KONTROL_KARAKTERI = /[\u0000-\u001f]/;
const KACIS_MESAJI = "kontrol karakteri var — ters bölü kaçışı bozulmuş (\\b, \\t…); yolda düz bölü kullan: C:/klasor";

const urlMi = (s) => {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

const cakisir = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function manifestDogrula(m, simdi = new Date()) {
  const sorunlar = [];
  const ekle = (seviye, yer, mesaj) => sorunlar.push({ seviye, yer, mesaj });

  if (!m || !Array.isArray(m.projeler)) {
    ekle("hata", "projeler", "\"projeler\" dizisi yok");
    return sorunlar;
  }
  const G = m.harita?.genislik ?? 780;
  const Y = m.harita?.yukseklik ?? 540;
  const idler = new Set();

  for (const [i, p] of m.projeler.entries()) {
    const yer = p?.id ? `projeler › ${p.id}` : `projeler[${i}]`;
    if (!p?.id || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) ekle("hata", yer, "id küçük harf/rakam/tire olmalı");
    else if (idler.has(p.id)) ekle("hata", yer, "aynı id iki kez kullanılmış");
    else idler.add(p.id);
    if (!p?.ad) ekle("hata", yer, "ad boş");
    if (!ASAMALAR.includes(p?.asama)) ekle("hata", yer, `asama "${p?.asama}" geçersiz — ${ASAMALAR.join(" · ")}`);
    if (!IKONLAR.includes(p?.ikon)) ekle("uyari", yer, `ikon "${p?.ikon}" tanınmıyor — ${IKONLAR.join(" · ")}`);
    if (typeof p?.konum?.x !== "number" || typeof p?.konum?.y !== "number") {
      ekle("hata", yer, "konum.x / konum.y sayı olmalı");
    } else if (p.konum.x < 0 || p.konum.y < 0 || p.konum.x > G || p.konum.y > Y) {
      ekle("uyari", yer, `konum haritanın dışında (${G}×${Y})`);
    }
    for (const alan of ["saglik", "url"]) {
      if (p?.[alan] != null && !urlMi(p[alan])) ekle("hata", yer, `${alan} geçerli bir http(s) adresi değil`);
    }
    if (p?.github != null && !/^[\w.-]+\/[\w.-]+$/.test(p.github)) ekle("hata", yer, "github \"sahip/repo\" biçiminde olmalı");
    if (typeof p?.repo === "string" && KONTROL_KARAKTERI.test(p.repo)) ekle("hata", yer, `repo: ${KACIS_MESAJI}`);
    if (p?.pm2 != null && !(Array.isArray(p.pm2) && p.pm2.every((x) => typeof x === "string"))) ekle("hata", yer, "pm2 süreç adları dizisi olmalı");
    if (p?.kapsam != null && !Array.isArray(p.kapsam)) ekle("hata", yer, "kapsam yol dizisi olmalı");

    if (p?.icSaglik != null) {
      if (!urlMi(p.icSaglik.url)) ekle("hata", yer, "icSaglik.url geçerli bir http(s) adresi değil");
      else if (p.icSaglik.tokenEnv != null && !loopbackMi(p.icSaglik.url)) ekle("hata", yer, "icSaglik.url bu makinenin adresi olmalı (127.0.0.1) — token dışarı gönderilmez");
      if (p.icSaglik.tokenEnv != null && !/^[A-Z_][A-Z0-9_]*$/.test(p.icSaglik.tokenEnv)) ekle("hata", yer, "icSaglik.tokenEnv BÜYÜK_HARF_ALT_ÇİZGİ bir ortam değişkeni adı olmalı (token'ın kendisi değil)");
    }
    if (p?.yayin != null) {
      const kurallar = p.yayin.adimlar;
      if (!Array.isArray(kurallar)) ekle("hata", yer, "yayin.adimlar dizi olmalı");
      else for (const [j, k] of kurallar.entries()) {
        if (typeof k?.adim !== "string" || !k.adim.trim()) ekle("hata", yer, `yayin.adimlar[${j}]: adim boş`);
        else if (KONTROL_KARAKTERI.test(k.adim)) ekle("hata", yer, `yayin.adimlar[${j}]: ${KACIS_MESAJI}`);
        if (k?.yol != null && typeof k.yol !== "string") ekle("hata", yer, `yayin.adimlar[${j}]: yol metin olmalı`);
        if (k?.dur != null && typeof k.dur !== "boolean") ekle("hata", yer, `yayin.adimlar[${j}]: dur true/false olmalı`);
        if (typeof k?.adim === "string" && !k.bilgi && /\bgit pull\b(?![^;]*--ff-only)/.test(k.adim)) ekle("uyari", yer, `yayin.adimlar[${j}]: git pull --ff-only yaz — ayrışmış dalda birleştirme commit'i açıp devam etmesin`);
        if (typeof k?.adim === "string" && /\bnpm run migrate\b(?!:)/.test(k.adim)) ekle("uyari", yer, `yayin.adimlar[${j}]: doğrudan migrate yerine önce migrate:verify (canlı defter bayat olabilir)`);
        if (typeof k?.yol === "string" && k.yol.startsWith("/")) ekle("uyari", yer, `yayin.adimlar[${j}]: yol repo köküne göredir, "/" ile başlamaz`);
      }
    }

    const adimIdleri = new Set();
    for (const a of p?.adimlar ?? []) {
      if (!a?.id || !a?.metin) ekle("hata", yer, "her adımın id ve metni olmalı");
      else if (adimIdleri.has(a.id)) ekle("hata", yer, `adım id "${a.id}" tekrarlanmış`);
      else adimIdleri.add(a.id);
      if (a?.etiket != null && !["engel", "sirada"].includes(a.etiket)) ekle("uyari", yer, `adım "${a?.id}" etiketi "${a.etiket}" — engel · sirada`);
    }

    for (const u of p?.uyarilar ?? []) {
      const metin = typeof u === "string" ? u : u?.metin;
      if (!metin) {
        ekle("hata", yer, "boş elle uyarı");
        continue;
      }
      const tarih = typeof u === "object" ? u.tarih : null;
      if (tarih) {
        const gun = Math.floor((simdi - new Date(tarih)) / 86_400_000);
        if (Number.isNaN(gun)) ekle("hata", yer, `uyarı tarihi okunamadı: "${tarih}"`);
        else if (gun >= ESKI_NOT_GUN) ekle("uyari", yer, `elle uyarı ${gun} gündür duruyor — hâlâ geçerli mi? "${metin}"`);
      }
    }
  }

  for (const p of m.projeler) {
    if (p?.ust && !idler.has(p.ust)) ekle("hata", `projeler › ${p.id}`, `ust "${p.ust}" diye bir düğüm yok`);
  }
  for (const [i, a] of (m.akislar ?? []).entries()) {
    for (const uc of ["kaynak", "hedef"]) {
      if (!idler.has(a?.[uc])) ekle("hata", `akislar[${i}]`, `${uc} "${a?.[uc]}" diye bir düğüm yok`);
    }
  }

  const kartlar = m.projeler.filter((p) => p?.kart && typeof p?.konum?.x === "number").map((p) => ({ p, k: kutuBul(p) }));
  for (let i = 0; i < kartlar.length; i++) {
    for (let j = i + 1; j < kartlar.length; j++) {
      if (cakisir(kartlar[i].k, kartlar[j].k)) ekle("uyari", "harita", `"${kartlar[i].p.ad}" ve "${kartlar[j].p.ad}" kartları üst üste biniyor`);
    }
  }
  return sorunlar;
}
