import type { Adim, Anlik, Proje } from "../types";

/** Projeyi ve tüm alt modüllerini kapsar; döngülü bir manifestte de sonlanır. */
export function projeKapsami(projeler: Proje[], id: string): Set<string> {
  const kapsam = new Set([id]);
  let eklendi = true;
  while (eklendi) {
    eklendi = false;
    for (const p of projeler) {
      if (p.ust && kapsam.has(p.ust) && !kapsam.has(p.id)) {
        kapsam.add(p.id);
        eklendi = true;
      }
    }
  }
  return kapsam;
}

/** Yüzde yalnız manifestte tanımlı adımlardan hesaplanır; aşama yüzde değildir. */
export function projeIlerlemesi(veri: Pick<Anlik, "projeler" | "adimlar">, id: string) {
  const kapsam = projeKapsami(veri.projeler, id);
  const adimlar: Adim[] = veri.adimlar.filter((a) => kapsam.has(a.projeId));
  const tamam = adimlar.filter((a) => a.tamam).length;
  return { adimlar, tamam, toplam: adimlar.length, yuzde: adimlar.length ? Math.round(tamam / adimlar.length * 100) : null };
}
