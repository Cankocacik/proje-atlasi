import type { LogSatiri } from "../types";

/**
 * Hata satırını "imza"ya indirger: zaman damgası, uuid, uzun onaltılık kimlik ve sayılar
 * yer tutucuya döner — böylece aynı hatanın binlerce tekrarı tek satırda sayılır.
 */
export function hataImzasi(metin: string): string {
  return metin
    .replace(/^\s*\[?\d{4}-\d{2}-\d{2}[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?\]?:?\s*/, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "‹uuid›")
    .replace(/\b[0-9a-f]{12,}\b/gi, "‹id›")
    .replace(/\d+(?:[.,]\d+)?/g, "‹n›")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/** Yığın izinin devam satırları ("    at fn (dosya:1:2)") ve anlamsız kırıntılar imza sayılmaz. */
const devamSatiri = (m: string) => /^\s+at\s/.test(m) || /^\s*[{}\[\](),;]*\s*$/.test(m) || m.trim().length < 4;

export interface HataGrubu {
  imza: string;
  sayi: number;
  ornek: string;
  /** En son görüldüğü satırın zamanı; satır Atlas açılmadan önce yazılmışsa null. */
  son: string | null;
}

export function hataOzeti(satirlar: LogSatiri[], sinir = 5): HataGrubu[] {
  const gruplar = new Map<string, HataGrubu>();
  for (const s of satirlar) {
    if (!s.hata || devamSatiri(s.metin)) continue;
    const imza = hataImzasi(s.metin);
    const g = gruplar.get(imza);
    const zaman = s.gecmis ? null : s.zaman;
    if (g) {
      g.sayi++;
      g.ornek = s.metin;
      if (zaman) g.son = zaman;
    } else {
      gruplar.set(imza, { imza, sayi: 1, ornek: s.metin, son: zaman });
    }
  }
  return [...gruplar.values()].sort((a, b) => b.sayi - a.sayi || (b.son ?? "").localeCompare(a.son ?? "")).slice(0, sinir);
}
