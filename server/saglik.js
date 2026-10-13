/** Siteye istek atar. 5xx ve ağ hatası "ayakta değil"; 401/403 ayakta sayılır. */
export async function saglikKontrol(url, zamanAsimiMs = 8000) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(zamanAsimiMs),
      headers: { "user-agent": "proje-atlasi/0.1 (saglik)" },
    });
    await r.body?.cancel();
    return { ok: r.status < 500, kod: r.status, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    const hata = e?.name === "TimeoutError" ? "zaman aşımı" : e?.cause?.code || e?.message || "bilinmeyen hata";
    return { ok: false, kod: null, ms: null, hata };
  }
}
