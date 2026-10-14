// Hangi olay bildirilir — tek kaynak: tarayıcı bildirimi (src/lib/olay.ts) ve Telegram aynı kuralı kullanır.
// Yalnız durum değişimi önemliyse: düşüş/durma/bozulma ve bunların geri gelişi.
// Yeni commit, canlıya alma, Atlas açılışı bildirim değildir (olay günlüğünde durur).
const GERI_GELIS_TURLERI = new Set(["site", "surec", "icsaglik", "denetim"]);

export function bildirilir(o) {
  return o.seviye === "hata" || (o.seviye === "iyi" && GERI_GELIS_TURLERI.has(o.tur));
}
