import type { Asama, Proje } from "../types";

export const ASAMA_ETIKET: Record<Asama, string> = {
  fikir: "Fikir",
  gelistirme: "Geliştirmede",
  bekliyor: "Canlıya bekliyor",
  canli: "Canlı",
  beklemede: "Beklemede",
};

/** Etiket aşamadan gelir; yüksek seviyeli otomatik uyarı (site çöktü vb.) üstüne yazar. */
export function durumEtiketi(p: Proje): string {
  if (p.uyarilar.some((u) => u.seviye === "yuksek")) return "Sorun var";
  return ASAMA_ETIKET[p.asama] ?? p.asama;
}
