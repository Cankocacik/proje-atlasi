// Harita çizgileri için saf geometri (test/geometri.test.ts).

export interface Kutu {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const KART_YUKSEKLIK = 124;
export const HUB_YUKSEKLIK = 136;

/** Kart ise kutusu, nokta ise sıfır boyutlu kutu (merkez = konum). */
export function kutuBul(p: { kart?: boolean; ikon: string; konum: { x: number; y: number; w?: number } }): Kutu {
  if (!p.kart) return { x: p.konum.x, y: p.konum.y, w: 0, h: 0 };
  return { x: p.konum.x, y: p.konum.y, w: p.konum.w ?? 190, h: p.ikon === "hub" ? HUB_YUKSEKLIK : KART_YUKSEKLIK };
}

export function merkez(k: Kutu) {
  return { x: k.x + k.w / 2, y: k.y + k.h / 2 };
}

/** Kutunun karşıdaki noktaya bakan kenar orta noktası; nokta düğümde merkezin kendisi. */
export function baglantiNoktasi(k: Kutu, karsi: { x: number; y: number }, yatay: boolean) {
  const m = merkez(k);
  if (k.w === 0) return m;
  if (yatay) return { x: karsi.x >= m.x ? k.x + k.w : k.x, y: m.y };
  return { x: m.x, y: karsi.y >= m.y ? k.y + k.h : k.y };
}

/**
 * İki düğüm arasında dik açılı (dirsekli) yol ve etiket konumu.
 * Ağırlıklı eksen yatay ise H-V-H, değilse V-H-V çizilir.
 */
export function dirsekYol(kaynak: Kutu, hedef: Kutu) {
  const km = merkez(kaynak);
  const hm = merkez(hedef);
  const yatay = Math.abs(hm.x - km.x) >= Math.abs(hm.y - km.y);
  const a = baglantiNoktasi(kaynak, hm, yatay);
  const b = baglantiNoktasi(hedef, km, yatay);
  if (yatay) {
    const orta = Math.round((a.x + b.x) / 2);
    return { d: `M${a.x} ${a.y} H${orta} V${b.y} H${b.x}`, etiket: { x: orta, y: Math.round((a.y + b.y) / 2) } };
  }
  const orta = Math.round((a.y + b.y) / 2);
  return { d: `M${a.x} ${a.y} V${orta} H${b.x} V${b.y}`, etiket: { x: Math.round((a.x + b.x) / 2), y: orta } };
}
