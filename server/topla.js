import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGerekirse, gitOzeti } from "./git.js";
import { githubOzeti } from "./github.js";
import { icSaglikOku, icSaglikUyarilari } from "./icSaglik.js";
import { manifestDogrula } from "./manifest.js";
import { saglikKontrol } from "./saglik.js";
import { akisiBirlestir, akisSec, ASAMA_SIRA, durumBul, haftalikOzet, uyarilariUret, yayinAdimlari } from "./turet.js";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFEST_YOLU = resolve(KOK, "projeler.json");
const ADIM_YOLU = resolve(KOK, "data", "adimlar.json");

export async function manifestOku() {
  return JSON.parse(await readFile(MANIFEST_YOLU, "utf8"));
}

async function adimDurumuOku() {
  try {
    return JSON.parse(await readFile(ADIM_YOLU, "utf8"));
  } catch {
    return {};
  }
}

export async function adimIsaretle(id, tamam) {
  const durum = await adimDurumuOku();
  if (tamam) durum[id] = new Date().toISOString();
  else delete durum[id];
  await mkdir(dirname(ADIM_YOLU), { recursive: true });
  await writeFile(ADIM_YOLU, JSON.stringify(durum, null, 2), "utf8");
}

// Site ve GitHub git'ten seyrek sorgulanır; sonuçlar önbellekte tutulur.
const onbellek = new Map();

async function onbellekli(anahtar, tazelikMs, zorla, uret) {
  const kayit = onbellek.get(anahtar);
  if (!zorla && kayit && Date.now() - kayit.zaman < tazelikMs) return kayit.sonuc;
  const sonuc = await uret();
  onbellek.set(anahtar, { zaman: Date.now(), sonuc });
  return sonuc;
}

/**
 * Manifest + git/GitHub + sağlık + pm2 + işaretli adımlar → ekranın tek anlık görüntüsü.
 * surecler: pm2 yoksa null; varsa [{ ad, durum, ..., sonSaatYenidenBaslama, hata15 }]
 */
export async function topla({ zorla = false, ayar, surecler = null, saglikKaydi = null, denetim = null }) {
  // saglikKaydi: { ekle(url, sonuc), ozet(url) } — erişilebilirlik geçmişi (isteğe bağlı)
  // denetim: son kurulum denetimi; hata/uyarıları `atlasKendisi` düğümüne uyarı olarak düşer
  const m = await manifestOku();
  const adimDurumu = await adimDurumuOku();
  const saglikMs = (m.saglikSaniye ?? 60) * 1000;
  const githubMs = (m.githubSaniye ?? 300) * 1000;
  const fetchMs = (m.fetchDakika ?? 5) * 60_000;

  async function gitGetir(p) {
    if (p.repo && existsSync(p.repo)) {
      // Fetch beklenmez: ilk ekran ağı beklemesin, "geride" sayısı bir sonraki taramada güncellenir.
      if (m.fetchDakika !== 0) fetchGerekirse(p.repo, zorla ? 0 : fetchMs);
      return gitOzeti(p.repo, { kapsam: p.kapsam, haric: p.haric, ortam: ayar.ortam });
    }
    if (p.github) {
      return onbellekli(`gh:${p.github}:${p.dal ?? "main"}`, githubMs, zorla, () =>
        githubOzeti(p.github, { dal: p.dal, token: ayar.githubToken }));
    }
    return p.repo ? { var: false, kaynak: "git" } : null;
  }

  // Kimliği/konumu bozuk düğüm ekranı çökertmesin: dışarıda kalır, manifestSorunlari'nda listelenir.
  const gecerli = (m.projeler ?? []).filter((p) => p?.id && p.ad && typeof p.konum?.x === "number" && typeof p.konum?.y === "number");
  const projeler = await Promise.all(
    gecerli.map(async (p) => {
      const [git, saglik] = await Promise.all([
        gitGetir(p),
        p.saglik
          ? onbellekli(`saglik:${p.saglik}`, saglikMs, zorla, async () => {
            const sonuc = await saglikKontrol(p.saglik);
            await saglikKaydi?.ekle(p.saglik, sonuc);
            return sonuc;
          })
          : null,
      ]);
      const saglikGecmisi = p.saglik && saglikKaydi ? await saglikKaydi.ozet(p.saglik) : null;
      // İç sağlık ucu loopback'tedir: yalnız sunucuda anlamlı (PC'de yerel geliştirme sunucusuna gitmesin).
      const icDurum = p.icSaglik?.url && ayar.ortam === "sunucu"
        ? await onbellekli(`ic:${p.icSaglik.url}`, saglikMs, zorla, () => icSaglikOku(p.icSaglik))
        : null;
      const projeSurecleri = surecler
        ? (p.pm2 ?? []).map((ad) => surecler.find((s) => s.ad === ad) ?? { ad, durum: "bulunamadı", sonSaatYenidenBaslama: 0, hata15: 0 })
        : [];
      const uyarilar = [
        ...uyarilariUret(p, git, saglik, { ortam: ayar.ortam, surecler: projeSurecleri }),
        ...icSaglikUyarilari(icDurum, { migrationUyarisi: p.icSaglik?.migrationUyarisi !== false }),
      ];
      if (p.atlasKendisi && denetim) {
        for (const d of denetim.sonuclar) {
          if (d.durum === "hata" || d.durum === "uyari") {
            uyarilar.push({ metin: `Kurulum · ${d.ad}: ${d.mesaj}`, kaynak: "denetim", seviye: d.durum === "hata" ? "yuksek" : "orta" });
          }
        }
      }
      return {
        ...p,
        git,
        saglik,
        saglikGecmisi,
        icDurum,
        surecler: projeSurecleri.map((s) => s.ad),
        uyarilar,
        durum: durumBul(p.asama, uyarilar),
        asamaSira: ASAMA_SIRA[p.asama] ?? 1,
      };
    }),
  );

  const tumAkis = akisiBirlestir(projeler, 1000);
  const adimlar = projeler.flatMap((p) =>
    (p.adimlar ?? []).map((a) => {
      const id = `${p.id}:${a.id}`;
      return { id, metin: a.metin, etiket: a.etiket ?? "sirada", projeId: p.id, tamam: Boolean(adimDurumu[id]) };
    }),
  );

  return {
    zaman: new Date().toISOString(),
    ortam: ayar.ortam,
    // Ekrandaki "sonraki tarama" halkası için (baslat() aynı değerle zamanlar).
    yenilemeSaniye: m.yenilemeSaniye ?? 20,
    manifestSorunlari: manifestDogrula(m),
    gorunum: m.gorunum ?? {},
    harita: m.harita ?? { genislik: 780, yukseklik: 540 },
    akislar: m.akislar ?? [],
    projeler: projeler.map(({ git, ...p }) => ({
      ...p,
      git: git && git.var
        ? {
          var: true, kaynak: git.kaynak, dal: git.dal, son: git.son, degisen: git.degisen, ileride: git.ileride, geride: git.geride, canlida: git.canlida ?? null,
          // Dosya listesi ekrana gitmez (büyük olabilir); yalnız sayısı ve ondan çıkan adımlar.
          bekleyen: git.bekleyen
            ? { toplam: git.bekleyen.toplam ?? git.bekleyen.commitler.length, commitler: git.bekleyen.commitler, dosyaSayisi: git.bekleyen.dosyalar.length, adimlar: yayinAdimlari(git.bekleyen.dosyalar, p.yayin?.adimlar) }
            : null,
        }
        : git,
    })),
    surecler: surecler?.map(({ outLog: _o, errLog: _e, ...s }) => s) ?? null,
    akis: akisSec(tumAkis, projeler.map((p) => p.id)),
    hafta: haftalikOzet(tumAkis),
    adimlar,
  };
}
