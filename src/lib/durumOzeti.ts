import type { Anlik, Proje } from "../types";

/** Ekranın tek bakışta söylediği: sorun (yüksek uyarı) · not (yalnız orta uyarı) · temiz. */
export type GenelDurum = "sorun" | "not" | "temiz";

export interface Vitaller {
  siteler: { ayakta: number; toplam: number; ortMs: number | null };
  /** pm2 yalnız sunucuda; PC'de null. */
  surecler: { calisan: number; toplam: number; yenidenBaslama: number } | null;
  /** Repo düzeyindeki projeler (modüller aynı repoyu tekrar saymaz). */
  repolar: { toplam: number; guncel: number; geride: number; yerelDegisen: number; yerelIleride: number; kirli: number };
  dikkat: { sorun: number; not: number; temiz: number; toplam: number };
  adimlar: { tamam: number; toplam: number; engel: number };
  genel: GenelDurum;
}

const repoDuzeyi = (p: Proje) => !p.kapsam?.length && Boolean(p.git?.var);

/** Saf: anlık görüntüden üst şeritteki canlı göstergeler. Uydurma yok — kaynağı olmayan alan null/0. */
export function vitaller(v: Pick<Anlik, "projeler" | "surecler" | "adimlar">): Vitaller {
  const izlenen = v.projeler.filter((p) => p.saglik);
  const ayakta = izlenen.filter((p) => p.saglik!.ok);
  const sureler = ayakta.map((p) => p.saglik!.ms).filter((ms): ms is number => typeof ms === "number");

  const repolar = v.projeler.filter(repoDuzeyi);
  const geride = repolar.reduce((t, p) => t + (p.git?.bekleyen?.toplam ?? p.git?.geride ?? 0), 0);

  let sorun = 0;
  let not = 0;
  for (const p of v.projeler) {
    if (p.uyarilar.some((u) => u.seviye === "yuksek")) sorun++;
    else if (p.uyarilar.length) not++;
  }

  return {
    siteler: {
      ayakta: ayakta.length,
      toplam: izlenen.length,
      ortMs: sureler.length ? Math.round(sureler.reduce((t, x) => t + x, 0) / sureler.length) : null,
    },
    surecler: v.surecler
      ? {
          calisan: v.surecler.filter((s) => s.durum === "online").length,
          toplam: v.surecler.length,
          yenidenBaslama: v.surecler.reduce((t, s) => t + (s.sonSaatYenidenBaslama ?? 0), 0),
        }
      : null,
    repolar: {
      toplam: repolar.length,
      guncel: repolar.filter((p) => !p.git?.geride).length,
      geride,
      yerelDegisen: repolar.reduce((t, p) => t + (p.git?.degisen ?? 0), 0),
      yerelIleride: repolar.reduce((t, p) => t + (p.git?.ileride ?? 0), 0),
      kirli: repolar.filter((p) => (p.git?.degisen ?? 0) > 0 || (p.git?.ileride ?? 0) > 0).length,
    },
    dikkat: { sorun, not, temiz: v.projeler.length - sorun - not, toplam: v.projeler.length },
    adimlar: {
      tamam: v.adimlar.filter((a) => a.tamam).length,
      toplam: v.adimlar.length,
      engel: v.adimlar.filter((a) => !a.tamam && a.etiket === "engel").length,
    },
    genel: sorun ? "sorun" : not ? "not" : "temiz",
  };
}

/** Başlığın altındaki tek cümle: en önemli durum önce. */
export function durumCumlesi(vit: Vitaller): string {
  const parcalar: string[] = [];
  if (vit.dikkat.sorun) parcalar.push(`${vit.dikkat.sorun} sistem sorunlu`);
  if (vit.siteler.toplam) {
    parcalar.push(vit.siteler.ayakta === vit.siteler.toplam ? `${vit.siteler.toplam} sitenin hepsi ayakta` : `${vit.siteler.toplam - vit.siteler.ayakta}/${vit.siteler.toplam} site yanıt vermiyor`);
  }
  if (vit.surecler) {
    parcalar.push(vit.surecler.calisan === vit.surecler.toplam ? `${vit.surecler.toplam} süreç çalışıyor` : `${vit.surecler.toplam - vit.surecler.calisan} süreç durmuş`);
  }
  if (vit.dikkat.not) parcalar.push(`${vit.dikkat.not} açık not`);
  return parcalar.join(" · ") || "İzlenen kaynak yok";
}

/**
 * Duvar modunda otomatik tur sırası: önce sorunlu, sonra notlu, sonra kalan kartlar ve modüller
 * (her grup kendi içinde manifest sırasında). Hiç düğüm yoksa boş.
 */
export function turSirasi(projeler: Proje[]): string[] {
  const derece = (p: Proje) => (p.uyarilar.some((u) => u.seviye === "yuksek") ? 0 : p.uyarilar.length ? 1 : p.kart ? 2 : 3);
  return projeler
    .map((p, i) => ({ id: p.id, d: derece(p), i }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.id);
}

/** Turda sıradaki düğüm: şu anki listede yoksa baştan başlar. */
export function turdakiSonraki(sira: string[], simdiki: string | null): string | null {
  if (!sira.length) return null;
  const i = simdiki ? sira.indexOf(simdiki) : -1;
  return sira[(i + 1) % sira.length];
}
