// Günlük özet: sabah tek mesajla "şu an açık olan ne" — anlık bildirim yalnız değişimi söyler.
// İsteğe bağlı: .env ATLAS_TELEGRAM_OZET=08:30 (Telegram açıksa). Saf; test/ozet.test.js.

const ISARET = { yuksek: "✗", orta: "!" };

/** "08:30" → { saat: 8, dakika: 30 } · geçersizse null */
export function saatCoz(metin) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(metin ?? "").trim());
  if (!m) return null;
  const saat = Number(m[1]);
  const dakika = Number(m[2]);
  return saat < 24 && dakika < 60 ? { saat, dakika } : null;
}

const gunAnahtari = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Bugünün özeti gönderilmeli mi: saat geçti ve bugün henüz gönderilmedi. */
export function ozetZamaniMi(hedef, sonGonderilen, simdi = new Date()) {
  if (!hedef) return false;
  const gecti = simdi.getHours() * 60 + simdi.getMinutes() >= hedef.saat * 60 + hedef.dakika;
  return gecti && sonGonderilen !== gunAnahtari(simdi);
}

export { gunAnahtari };

export function gunlukOzet(anlik, { simdi = new Date(), host = null, sinir = 8 } = {}) {
  const projeler = anlik?.projeler ?? [];
  const tarih = `${String(simdi.getDate()).padStart(2, "0")}.${String(simdi.getMonth() + 1).padStart(2, "0")}`;
  const satirlar = [`Proje Atlası — günlük özet (${tarih})`, ""];

  const uyarilar = projeler.flatMap((p) => p.uyarilar.map((u) => ({ p, u })))
    .sort((a, b) => (a.u.seviye === b.u.seviye ? 0 : a.u.seviye === "yuksek" ? -1 : 1));
  const dikkat = new Set(uyarilar.map((x) => x.p.id)).size;
  if (!uyarilar.length) {
    satirlar.push("✓ Dikkat bekleyen iş yok.");
  } else {
    satirlar.push(`Dikkat: ${dikkat} proje / modül`);
    for (const { p, u } of uyarilar.slice(0, sinir)) satirlar.push(`${ISARET[u.seviye] ?? "!"} ${p.ad}: ${u.metin}`);
    if (uyarilar.length > sinir) satirlar.push(`… +${uyarilar.length - sinir} uyarı daha`);
  }

  const bekleyen = projeler.filter((p) => !p.kapsam?.length && p.git?.bekleyen?.commitler?.length);
  if (bekleyen.length) {
    const ad = anlik.ortam === "sunucu" ? "Canlıya bekleyen" : "Çekilmemiş";
    satirlar.push("", `${ad}: ${bekleyen.map((p) => `${p.ad} ${p.git.geride ?? p.git.bekleyen.commitler.length} commit`).join(" · ")}`);
  }

  const erisim = projeler.filter((p) => p.saglikGecmisi?.yuzde != null && p.saglikGecmisi.yuzde < 100);
  if (erisim.length) satirlar.push("", `Erişim (24 sa): ${erisim.map((p) => `${p.ad} %${p.saglikGecmisi.yuzde}`).join(" · ")}`);

  const gunOnce = simdi.getTime() - 24 * 60 * 60_000;
  const sonOlaylar = (anlik?.olaylar ?? []).filter((o) => new Date(o.zaman).getTime() >= gunOnce);
  if (sonOlaylar.length) {
    const sorun = sonOlaylar.filter((o) => o.seviye === "hata").length;
    satirlar.push("", `Son 24 saat: ${sonOlaylar.length} olay${sorun ? ` (${sorun} sorun)` : ""}`);
  }

  if (host) satirlar.push("", `https://${host}`);
  return satirlar.join("\n").slice(0, 3900);
}
