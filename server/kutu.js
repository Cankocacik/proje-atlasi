// Harita kartı ölçüleri — tek kaynak: hem arayüz (src/lib/geometri.ts) hem sunucu
// (manifest denetimindeki çakışma kontrolü) buradan okur.
export const KART_YUKSEKLIK = 124;
export const HUB_YUKSEKLIK = 136;

/** Kart ise kutusu, nokta ise sıfır boyutlu kutu (merkez = konum). */
export function kutuBul(p) {
  if (!p.kart) return { x: p.konum.x, y: p.konum.y, w: 0, h: 0 };
  return { x: p.konum.x, y: p.konum.y, w: p.konum.w ?? 190, h: p.ikon === "hub" ? HUB_YUKSEKLIK : KART_YUKSEKLIK };
}
