// Telegram bildirimi: sayfa kapalıyken de haber verir. Varsayılan KAPALI —
// .env'de ATLAS_TELEGRAM_TOKEN + ATLAS_TELEGRAM_SOHBET yoksa hiçbir şey gönderilmez.
// Token ekrana, anlık görüntüye, loga girmez.

export function telegramAyari(env = process.env) {
  const token = env.ATLAS_TELEGRAM_TOKEN?.trim();
  const sohbet = env.ATLAS_TELEGRAM_SOHBET?.trim();
  // ATLAS_TELEGRAM_API: vekil sunucu ya da deneme için taban adres (varsayılan api.telegram.org).
  const api = env.ATLAS_TELEGRAM_API?.trim().replace(/\/$/, "");
  return token && sohbet ? { token, sohbet, ...(api ? { api } : {}) } : null;
}

const ISARET = { hata: "✗", iyi: "✓", uyari: "!", bilgi: "·" };

/** Saf: aynı taramada çıkan olayları tek mesajda toplar. */
export function mesajMetni(olaylar, { host = null } = {}) {
  const satirlar = olaylar.map((o) => `${ISARET[o.seviye] ?? "·"} ${o.metin}`);
  const sorun = olaylar.filter((o) => o.seviye === "hata").length;
  const baslik = sorun ? `Proje Atlası — ${sorun} sorun` : "Proje Atlası";
  return [baslik, "", ...satirlar, ...(host ? ["", `https://${host}`] : [])].join("\n").slice(0, 3900);
}

/** Saatte en çok `sinir` mesaj: bir şey çırpınırken telefon susmazsa bildirim değersizleşir. */
export function kisici(sinir = 20, pencereMs = 60 * 60_000) {
  let zamanlar = [];
  let bastirilan = 0;
  return {
    izinli(simdi = Date.now()) {
      zamanlar = zamanlar.filter((t) => simdi - t < pencereMs);
      if (zamanlar.length >= sinir) {
        bastirilan++;
        return false;
      }
      zamanlar.push(simdi);
      return true;
    },
    /** Kısıtlama yüzünden gönderilmeyen mesaj sayısını verir ve sıfırlar. */
    bastirilaniAl() {
      const n = bastirilan;
      bastirilan = 0;
      return n;
    },
  };
}

async function istek(ayar, yontem, govde, fetchFn) {
  const r = await fetchFn(`${ayar.api ?? "https://api.telegram.org"}/bot${ayar.token}/${yontem}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde ?? {}),
    signal: AbortSignal.timeout(10000),
  });
  const veri = await r.json().catch(() => ({}));
  // Telegram hata açıklaması token içermez; yine de yalnız açıklama döndürülür.
  if (!r.ok || veri.ok === false) throw new Error(`Telegram ${r.status}${veri.description ? `: ${veri.description}` : ""}`);
  return veri.result;
}

export function telegramGonder(ayar, metin, fetchFn = fetch) {
  return istek(ayar, "sendMessage", { chat_id: ayar.sohbet, text: metin, disable_web_page_preview: true }, fetchFn);
}

export function telegramBot(ayar, fetchFn = fetch) {
  return istek(ayar, "getMe", {}, fetchFn);
}

/** Bota yazmış sohbetlerin kimlikleri (kurulumda ATLAS_TELEGRAM_SOHBET'i bulmak için). */
export async function telegramSohbetleri(token, fetchFn = fetch) {
  const sonuc = await istek({ token }, "getUpdates", {}, fetchFn);
  const sohbetler = new Map();
  for (const u of sonuc ?? []) {
    const c = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
    if (c) sohbetler.set(c.id, { id: c.id, ad: c.title ?? [c.first_name, c.last_name].filter(Boolean).join(" ") ?? c.username, tur: c.type });
  }
  return [...sohbetler.values()];
}
