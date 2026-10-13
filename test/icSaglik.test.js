import { describe, expect, it } from "vitest";
import { durumNormalle, icSaglikOku, icSaglikUyarilari, icSaglikYorumla } from "../server/icSaglik.js";
import { olaylariBul } from "../server/olaylar.js";

// Rosbel backend /api/health/detailed yanıtının biçimi (backend/src/routes/health.js).
const rosbel = (ek = {}) => ({
  status: "healthy",
  checks: {
    portal: { ok: true, latencyMs: 3 },
    konfeksiyon: { ok: true, latencyMs: 12 },
    redis: { configured: false, ok: true, note: "Redis kullanilmiyor" },
    migrations: { ok: true, totalFiles: 140, pending: 0, pendingFiles: [], unknownApplied: 0 },
    approvalPartialCommit: { ok: true },
    ...ek,
  },
});

describe("icSaglikYorumla", () => {
  it("Rosbel biçimini okur; kullanılmayan Redis listeye girmez", () => {
    const s = icSaglikYorumla(200, rosbel());
    expect(s.erisim).toBe("ok");
    expect(s.durum).toBe("healthy");
    expect(s.kontroller.map((k) => [k.ad, k.ok, k.ms])).toEqual([
      ["Portal veritabanı", true, 3],
      ["ERP veritabanı", true, 12],
      ["Onay tutarlılığı", true, null],
    ]);
    expect(s.migration).toMatchObject({ ok: true, bekleyen: 0 });
  });

  it("Mutabiko biçimini (db: ok|hata) okur", () => {
    expect(icSaglikYorumla(503, { status: "degraded", db: "hata" }).kontroller).toEqual([
      { anahtar: "db", ad: "Veritabanı", ok: false, ms: null, not: "hata" },
    ]);
  });

  it("401 yetki, gövdesiz yanıt biçim hatası", () => {
    expect(icSaglikYorumla(401, { message: "x" }).erisim).toBe("yetki");
    expect(icSaglikYorumla(500, null)).toMatchObject({ erisim: "hata", hata: "beklenmeyen yanıt (500)" });
  });
});

describe("icSaglikUyarilari", () => {
  it("sağlıklıda uyarı yok", () => {
    expect(icSaglikUyarilari(icSaglikYorumla(200, rosbel()))).toEqual([]);
  });

  it("DB düşüşü ve kısmi commit alarmı yüksek; bekleyen migration orta ve verify'a yönlendirir", () => {
    const s = icSaglikYorumla(503, rosbel({
      konfeksiyon: { ok: false, latencyMs: 1500, error: "konfeksiyon-db timeout (1500ms)" },
      migrations: { ok: false, pending: 2, pendingFiles: ["2026-10-06-numune.sql", "2026-10-06-bulk.sql"], unknownApplied: 0 },
      approvalPartialCommit: { ok: false },
    }));
    expect(icSaglikUyarilari(s).map((u) => [u.seviye, u.metin])).toEqual([
      ["yuksek", "ERP veritabanı yanıt vermiyor — konfeksiyon-db timeout (1500ms)"],
      ["yuksek", "ERP'ye yazılıp portala yazılamamış onay var (kısmi commit alarmı)"],
      ["orta", "Defterde 2 migration bekliyor (defter bayat olabilir — npm run migrate:verify)"],
    ]);
    expect(s.migration.dosyalar).toEqual(["2026-10-06-numune.sql", "2026-10-06-bulk.sql"]);
    // Migration uyarısı manifestten kapatılabilir (defter bilerek bayatsa gürültü olmasın).
    expect(icSaglikUyarilari(s, { migrationUyarisi: false }).map((u) => u.seviye)).toEqual(["yuksek", "yuksek"]);
  });

  it("ulaşılamazsa yüksek; yetki sorunu projeyi boyamaz (kurulum denetimine kalır)", () => {
    expect(icSaglikUyarilari({ erisim: "ag", hata: "ECONNREFUSED" })[0]).toMatchObject({ seviye: "yuksek", metin: "İç sağlık ucuna ulaşılamıyor (ECONNREFUSED)" });
    expect(icSaglikUyarilari({ erisim: "yetki", kontroller: [] })).toEqual([]);
  });
});

describe("icSaglikOku", () => {
  it("token'ı env'den x-health-token başlığına koyar, yanıtı yorumlar", async () => {
    let baslik = null;
    const fetchFn = async (_url, secenek) => {
      baslik = secenek.headers["x-health-token"];
      return { status: 200, json: async () => rosbel() };
    };
    const s = await icSaglikOku({ url: "http://127.0.0.1:4000/api/health/detailed", tokenEnv: "ROSBEL_HEALTH_TOKEN" }, { env: { ROSBEL_HEALTH_TOKEN: "gizli-cok-uzun-token" }, fetchFn });
    expect(baslik).toBe("gizli-cok-uzun-token");
    expect(s).toMatchObject({ erisim: "ok", kod: 200, tokenVar: true });
    expect(JSON.stringify(s)).not.toContain("gizli-cok-uzun-token");
  });

  it("ağ hatasında erişim 'ag'", async () => {
    const e = Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    expect(await icSaglikOku({ url: "http://127.0.0.1:1" }, { fetchFn: async () => { throw e; } })).toMatchObject({ erisim: "ag", hata: "ECONNREFUSED" });
  });
});

describe("durumNormalle", () => {
  it("Rosbel ve Mutabiko sözcükleri tek sözlüğe iner; düşen kontrol sözcüğü ezer", () => {
    expect(durumNormalle("healthy")).toBe("healthy");
    expect(durumNormalle("ok")).toBe("healthy");
    expect(durumNormalle(undefined)).toBe("healthy");
    expect(durumNormalle("degraded")).toBe("degraded");
    expect(durumNormalle("unhealthy")).toBe("unhealthy");
    expect(durumNormalle("ok", [{ ok: false }])).toBe("unhealthy");
  });

  it("Mutabiko DB düşünce (status: degraded) olay 'hata' seviyesindedir — bildirim gider", () => {
    const once = { projeler: [{ id: "m", ad: "Mutabiko", icDurum: icSaglikYorumla(200, { status: "ok", db: "ok" }) }] };
    const sonra = { projeler: [{ id: "m", ad: "Mutabiko", icDurum: icSaglikYorumla(503, { status: "degraded", db: "ECONNREFUSED" }) }] };
    expect(olaylariBul(once, sonra)).toEqual([expect.objectContaining({ seviye: "hata", tur: "icsaglik", metin: "Mutabiko: iç sağlık bozuk — Veritabanı" })]);
    expect(olaylariBul(sonra, once)).toEqual([expect.objectContaining({ seviye: "iyi", metin: "Mutabiko: iç sağlık düzeldi" })]);
  });
});

describe("icSaglikOku güvenliği", () => {
  it("token yalnız loopback adrese gider; yönlendirme izlenmez", async () => {
    const cagrilar = [];
    const fetchFn = async (url, secenek) => {
      cagrilar.push({ url, token: secenek.headers["x-health-token"], redirect: secenek.redirect });
      return { status: 200, json: async () => rosbel() };
    };
    const env = { T: "gizli-cok-uzun-token" };
    await icSaglikOku({ url: "https://baska-bir-yer.example/health", tokenEnv: "T" }, { env, fetchFn });
    await icSaglikOku({ url: "http://127.0.0.1:4000/api/health/detailed", tokenEnv: "T" }, { env, fetchFn });
    expect(cagrilar.map((c) => [c.token ?? null, c.redirect])).toEqual([[null, "manual"], ["gizli-cok-uzun-token", "manual"]]);
  });
});
