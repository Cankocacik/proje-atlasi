import type { Olay } from "../types";

/**
 * Bildirim için: son görülen kimlikten sonra gelen olaylar (eskiden yeniye).
 * İlk yüklemede (sonGorulen null) geçmiş olaylar bildirilmez — yalnız sayfa açıkken olanlar.
 */
export function yeniOlaylar(olaylar: Olay[] | undefined, sonGorulen: number | null): { yeniler: Olay[]; enBuyuk: number | null } {
  const liste = olaylar ?? [];
  const enBuyuk = liste.reduce<number | null>((m, o) => (m === null || o.id > m ? o.id : m), sonGorulen);
  if (sonGorulen === null) return { yeniler: [], enBuyuk };
  return { yeniler: liste.filter((o) => o.id > sonGorulen).sort((a, b) => a.id - b.id), enBuyuk };
}

/** Bildirim yalnız durum değişimi önemliyse: düşüş/durma ve geri geliş. */
export const bildirilir = (o: Olay) => o.seviye === "hata" || (o.seviye === "iyi" && (o.tur === "site" || o.tur === "surec"));

export function olayZamani(iso: string, simdi: Date): string {
  const d = new Date(iso);
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const ayniGun = d.toDateString() === simdi.toDateString();
  // ICU tr-TR gün+ay için "13/10" verir; Türkçe yazımdaki "13.10" elle kurulur.
  const gunAy = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return ayniGun ? saat : `${gunAy} ${saat}`;
}

/** Erişilebilirlik kutusunun kapsadığı saat aralığı (kutu 0 = 24 sa önce). */
export function kutuAraligi(i: number, toplam: number, simdi: Date, kutuDk = 30): string {
  const son = new Date(simdi.getTime() - (toplam - 1 - i) * kutuDk * 60_000);
  const bas = new Date(son.getTime() - kutuDk * 60_000);
  const f = (d: Date) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${f(bas)}–${f(son)}`;
}
