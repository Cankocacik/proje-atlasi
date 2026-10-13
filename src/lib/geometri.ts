// Harita çizgileri için saf geometri (test/geometri.test.ts).

// Kart ölçüleri sunucuyla ortak (manifest çakışma denetimi de aynısını kullanır).
import type { Kutu } from "../../server/kutu.js";
export type { Kutu } from "../../server/kutu.js";
export { HUB_YUKSEKLIK, KART_YUKSEKLIK, kutuBul } from "../../server/kutu.js";

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
