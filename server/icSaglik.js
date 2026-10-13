// İç sağlık: uygulamanın kendi ayrıntılı sağlık ucu (veritabanı, ERP, Redis, migration defteri,
// onay tutarlılığı). Yalnız sunucuda, loopback adresten okunur; token .env'den gelir, ekrana gitmez.
//
// Manifest: "icSaglik": { "url": "http://127.0.0.1:4000/api/health/detailed", "tokenEnv": "ROSBEL_HEALTH_TOKEN",
//                         "migrationUyarisi": true }

const KONTROL_AD = {
  portal: "Portal veritabanı",
  konfeksiyon: "ERP veritabanı",
  redis: "Redis",
  approvalPartialCommit: "Onay tutarlılığı",
};

/** Saf: HTTP kodu + gövde → ortak şekil. Rosbel (checks{}) ve Mutabiko (db) biçimlerini tanır. */
export function icSaglikYorumla(kod, govde) {
  if (kod === 401 || kod === 403) return { erisim: "yetki", durum: null, kontroller: [], migration: null };
  if (!govde || typeof govde !== "object") return { erisim: "hata", durum: null, kontroller: [], migration: null, hata: `beklenmeyen yanıt (${kod})` };

  const kontroller = [];
  let migration = null;
  const c = govde.checks;
  if (c && typeof c === "object") {
    for (const [anahtar, k] of Object.entries(c)) {
      if (anahtar === "migrations") {
        migration = {
          ok: Boolean(k?.ok),
          bekleyen: Number(k?.pending ?? 0),
          dosyalar: Array.isArray(k?.pendingFiles) ? k.pendingFiles.slice(0, 10) : [],
          bilinmeyen: Number(k?.unknownApplied ?? 0),
          hata: k?.error ?? null,
        };
        continue;
      }
      if (anahtar === "redis" && k?.configured === false) continue;
      kontroller.push({
        anahtar,
        ad: KONTROL_AD[anahtar] ?? anahtar,
        ok: Boolean(k?.ok),
        ms: typeof k?.latencyMs === "number" ? k.latencyMs : null,
        not: k?.error ?? k?.note ?? null,
      });
    }
  } else if ("db" in govde) {
    kontroller.push({ anahtar: "db", ad: "Veritabanı", ok: govde.db === "ok", ms: null, not: govde.db === "ok" ? null : String(govde.db) });
  }
  return { erisim: "ok", durum: durumNormalle(govde.status, kontroller), kontroller, migration };
}

/**
 * Uygulamalar durumu farklı sözcüklerle yazar (Rosbel healthy/unhealthy, Mutabiko ok/degraded):
 * olay günlüğü ve bildirim tek sözlük ister. Düşen kontrol varsa sözcüğe bakılmaz → "unhealthy"
 * (Mutabiko DB düşünce "degraded" der; bu bildirilmesi gereken bir kesintidir).
 */
export function durumNormalle(status, kontroller = []) {
  if (kontroller.some((k) => !k.ok)) return "unhealthy";
  const s = String(status ?? "").toLowerCase();
  if (!s || s === "ok" || s === "healthy" || s === "up") return "healthy";
  if (s === "degraded" || s === "warn" || s === "warning") return "degraded";
  return "unhealthy";
}

/** Token yalnız bu makineye gider: manifestte yanlış adres token'ı dışarı taşımasın. */
export function loopbackMi(url) {
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1";
  } catch {
    return false;
  }
}

/** Saf: yorumlanmış sonuçtan proje uyarıları. */
export function icSaglikUyarilari(s, { migrationUyarisi = true } = {}) {
  if (!s) return [];
  if (s.erisim === "ag") return [{ metin: `İç sağlık ucuna ulaşılamıyor (${s.hata})`, kaynak: "icsaglik", seviye: "yuksek" }];
  if (s.erisim !== "ok") return []; // yetki/biçim sorunu kurulum denetiminde görünür, projeyi kırmızıya boyamaz
  const liste = [];
  for (const k of s.kontroller) {
    if (k.ok) continue;
    const metin = k.anahtar === "approvalPartialCommit"
      ? "ERP'ye yazılıp portala yazılamamış onay var (kısmi commit alarmı)"
      : `${k.ad} yanıt vermiyor${k.not ? ` — ${k.not}` : ""}`;
    liste.push({ metin, kaynak: "icsaglik", seviye: "yuksek" });
  }
  if (migrationUyarisi && s.migration) {
    if (s.migration.hata) liste.push({ metin: `Migration defteri okunamadı — ${s.migration.hata}`, kaynak: "icsaglik", seviye: "orta" });
    else if (s.migration.bekleyen > 0) {
      liste.push({ metin: `Defterde ${s.migration.bekleyen} migration bekliyor (defter bayat olabilir — npm run migrate:verify)`, kaynak: "icsaglik", seviye: "orta" });
    }
  }
  return liste;
}

export async function icSaglikOku({ url, tokenEnv }, { env = process.env, fetchFn = fetch } = {}) {
  const t0 = performance.now();
  try {
    const token = tokenEnv && loopbackMi(url) ? env[tokenEnv] : null;
    // Yönlendirme izlenmez: fetch özel başlığı (x-health-token) başka kökene de taşır.
    const r = await fetchFn(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
      headers: { accept: "application/json", ...(token ? { "x-health-token": token } : {}) },
    });
    const govde = await r.json().catch(() => null);
    return { ...icSaglikYorumla(r.status, govde), kod: r.status, ms: Math.round(performance.now() - t0), tokenVar: Boolean(token) };
  } catch (e) {
    return { erisim: "ag", durum: null, kontroller: [], migration: null, hata: e?.cause?.code ?? e?.name ?? "ağ hatası", kod: null, ms: null };
  }
}
