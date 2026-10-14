/**
 * Yanıt kodunu "ayakta mı" kararına çevirir. 2xx/3xx ayakta; 401/403 da ayakta (site çalışıyor,
 * yalnız giriş istiyor). 404 ayakta DEĞİL: izlenen adres bilerek seçilir, bulunamaması
 * yanlış yönlendirme demektir (ör. Cloudflare tüneli isteği uygulamaya iletmiyor).
 */
export function kodAyakta(kod) {
  return (kod >= 200 && kod < 400) || kod === 401 || kod === 403;
}

/** Siteye istek atar; ağ hatası ve zaman aşımı "ayakta değil". */
export async function saglikKontrol(url, zamanAsimiMs = 8000) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(zamanAsimiMs),
      headers: { "user-agent": "proje-atlasi/0.1 (saglik)" },
    });
    await r.body?.cancel();
    return { ok: kodAyakta(r.status), kod: r.status, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    const hata = e?.name === "TimeoutError" ? "zaman aşımı" : e?.cause?.code || e?.message || "bilinmeyen hata";
    return { ok: false, kod: null, ms: null, hata };
  }
}
