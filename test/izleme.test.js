import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configteHostVar, disErisimYorumu, doktor, githubDurumu, nodeSurumuYeterli, ozetle } from "../server/doktor.js";
import { olayDeposu, olaylariBul } from "../server/olaylar.js";
import { kutula, saglikGecmisi } from "../server/gecmis.js";

const proje = (ek) => ({ id: "rosbel", ad: "Rosbel Portal", saglik: { ok: true, kod: 200 }, git: null, surecler: [], ...ek });
const anlik = (projeler, ek = {}) => ({ ortam: "sunucu", projeler, surecler: null, ...ek });

describe("olaylariBul", () => {
  it("ilk anlık görüntüde olay üretmez", () => {
    expect(olaylariBul(null, anlik([proje()]))).toEqual([]);
  });

  it("site düşüşünü ve geri gelişini yakalar; değişmeyen durum olay değildir", () => {
    const ayakta = anlik([proje()]);
    const dustu = anlik([proje({ saglik: { ok: false, kod: 530 } })]);
    expect(olaylariBul(ayakta, ayakta)).toEqual([]);
    expect(olaylariBul(ayakta, dustu)).toEqual([{ seviye: "hata", tur: "site", projeId: "rosbel", metin: "Rosbel Portal: site yanıt vermiyor (530)" }]);
    expect(olaylariBul(dustu, ayakta)[0]).toMatchObject({ seviye: "iyi", metin: "Rosbel Portal: site yeniden yanıt veriyor (200)" });
  });

  it("yeni commit ve canlıya alınmayı repo düzeyinde yazar, modülde tekrarlamaz", () => {
    const git = (hash, tarih, canlida) => ({ son: { hash, kisa: hash.slice(0, 7), tarih, mesaj: `m-${hash}` }, canlida });
    const once = anlik([proje({ git: git("aaaaaaa1", "2026-10-13T10:00:00Z", "aaaaaaa") }), proje({ id: "mutabakat", ad: "Mutabakat", kapsam: ["x"], git: git("aaaaaaa1", "2026-10-13T10:00:00Z", "aaaaaaa") })]);
    const sonra = anlik([proje({ git: git("bbbbbbb2", "2026-10-14T09:00:00Z", "bbbbbbb") }), proje({ id: "mutabakat", ad: "Mutabakat", kapsam: ["x"], git: git("bbbbbbb2", "2026-10-14T09:00:00Z", "bbbbbbb") })]);
    expect(olaylariBul(once, sonra).map((o) => [o.tur, o.projeId, o.metin])).toEqual([
      ["commit", "rosbel", "Rosbel Portal: yeni commit — m-bbbbbbb2 (bbbbbbb)"],
      ["yayin", "rosbel", "Rosbel Portal canlıya alındı: aaaaaaa → bbbbbbb"],
    ]);
    // Yerelde HEAD değişimi "canlıya alındı" sayılmaz.
    expect(olaylariBul({ ...once, ortam: "yerel" }, { ...sonra, ortam: "yerel" }).map((o) => o.tur)).toEqual(["commit"]);
  });

  it("pm2: durma, geri gelme, yeniden başlama, listeden çıkma — sahibi projeye bağlanır", () => {
    const s = (ad, durum, n) => ({ ad, durum, yenidenBaslama: n });
    const p = [proje({ surecler: ["siparis-backend"] })];
    const once = anlik(p, { surecler: [s("siparis-backend", "online", 3), s("mutabiko-api", "online", 1)] });
    expect(olaylariBul(once, anlik(p, { surecler: [s("siparis-backend", "errored", 3), s("mutabiko-api", "online", 2)] })).map((o) => [o.seviye, o.projeId, o.metin])).toEqual([
      ["hata", "rosbel", "siparis-backend durdu (errored)"],
      ["uyari", undefined, "mutabiko-api yeniden başladı (↻ 2)"],
    ]);
    expect(olaylariBul(once, anlik(p, { surecler: [s("siparis-backend", "online", 3)] }))[0].metin).toBe("mutabiko-api pm2 listesinden çıktı");
  });
});

describe("olayDeposu", () => {
  it("yeniden eskiye saklar, kimlik ve zaman ekler, sınırı uygular, diske yazar", async () => {
    const dosya = join(await mkdtemp(join(tmpdir(), "atlas-olay-")), "olaylar.json");
    const depo = olayDeposu({ dosya, sinir: 3 });
    await depo.ekle([{ metin: "a" }, { metin: "b" }], new Date("2026-10-14T08:00:00Z"));
    await depo.ekle([{ metin: "c" }, { metin: "d" }], new Date("2026-10-14T09:00:00Z"));
    const liste = await depo.son();
    expect(liste.map((o) => [o.id, o.metin])).toEqual([[4, "d"], [3, "c"], [2, "b"]]);
    expect(liste[0].zaman).toBe("2026-10-14T09:00:00.000Z");
    await new Promise((r) => setTimeout(r, 1200));
    const diskte = JSON.parse(await readFile(dosya, "utf8"));
    expect(diskte).toHaveLength(3);
    // Yeniden açılan depo kimlik saymaya kaldığı yerden devam eder.
    const yeni = olayDeposu({ dosya, sinir: 3 });
    expect((await yeni.ekle([{ metin: "e" }]))[0].id).toBe(5);
  });
});

describe("erişilebilirlik geçmişi", () => {
  const SAAT = 60 * 60_000;
  const simdi = Date.UTC(2026, 9, 14, 12, 0);

  it("24 saati 48 kutuya böler: tam başarılı, kısmi, düşük, veri yok", () => {
    const ornekler = [
      { t: simdi - 10 * 60_000, ok: true, ms: 100 },
      { t: simdi - 20 * 60_000, ok: true, ms: 300 },
      { t: simdi - 40 * 60_000, ok: true, ms: 200 },
      { t: simdi - 50 * 60_000, ok: false },
      { t: simdi - 2 * SAAT + 1, ok: false },
      { t: simdi - 25 * SAAT, ok: false }, // pencere dışı
    ];
    const k = kutula(ornekler, simdi);
    expect(k.kutular).toHaveLength(48);
    expect(k.kutular.at(-1)).toBe("ok");
    expect(k.kutular.at(-2)).toBe("kismi");
    expect(k.kutular.at(-4)).toBe("hata");
    expect(k.kutular[0]).toBeNull();
    expect(k).toMatchObject({ yuzde: 60, ortalamaMs: 200, ornek: 5 });
  });

  it("veri yoksa yüzde null", () => {
    expect(kutula([], simdi)).toMatchObject({ yuzde: null, ortalamaMs: null, ornek: 0 });
  });

  it("depo 24 saatten eski örneği atar", async () => {
    const dosya = join(await mkdtemp(join(tmpdir(), "atlas-gecmis-")), "g.json");
    const g = saglikGecmisi({ dosya });
    await g.ekle("https://x", { ok: false }, simdi - 25 * SAAT);
    await g.ekle("https://x", { ok: true, ms: 50 }, simdi);
    expect(await g.ozet("https://x", simdi)).toMatchObject({ yuzde: 100, ornek: 1 });
  });
});

describe("doktor yardımcıları", () => {
  it("Node sürüm eşiği (process.loadEnvFile)", () => {
    expect(nodeSurumuYeterli("v22.11.0")).toBe(true);
    expect(nodeSurumuYeterli("v20.12.0")).toBe(true);
    expect(nodeSurumuYeterli("v20.11.1")).toBe(false);
    expect(nodeSurumuYeterli("v21.6.0")).toBe(false);
    expect(nodeSurumuYeterli("v18.20.0")).toBe(false);
  });

  it("config.yml'de alan adı kuralını bulur, yorum satırını saymaz", () => {
    const yaml = "ingress:\n  - hostname: api.rosbelportal.com\n    service: http://localhost:4000\n  # - hostname: atlas.rosbelportal.com\n  - service: http_status:404\n";
    expect(configteHostVar(yaml, "api.rosbelportal.com")).toBe(true);
    expect(configteHostVar(yaml, "atlas.rosbelportal.com")).toBe(false);
    expect(configteHostVar(`${yaml}  - hostname: "atlas.rosbelportal.com"\n`, "atlas.rosbelportal.com")).toBe(true);
    expect(configteHostVar("  - hostname: xatlas.rosbelportal.com", "atlas.rosbelportal.com")).toBe(false);
  });

  it("GitHub yanıt kodlarını yorumlar", () => {
    expect(githubDurumu(200).durum).toBe("ok");
    expect(githubDurumu(401).mesaj).toContain("süresi dolmuş");
    expect(githubDurumu(404).cozum).toContain("Repository access");
  });

  it("dışarıdan erişimi yorumlar: Cloudflare 404 = tünel kuralı yok", () => {
    expect(disErisimYorumu({ kod: 200, govde: { girisGerekli: true, kimlikHazir: true } }).durum).toBe("ok");
    expect(disErisimYorumu({ kod: 200, govde: { girisGerekli: true, kimlikHazir: false } }).mesaj).toContain("giriş ayarlanmamış");
    expect(disErisimYorumu({ kod: 200, govde: { girisGerekli: false } }).durum).toBe("hata");
    expect(disErisimYorumu({ kod: 404, atlasBasligi: false }).mesaj).toContain("Atlas'a yönlenmiyor");
    expect(disErisimYorumu({ kod: 530 }).mesaj).toContain("tünel kapalı");
    expect(disErisimYorumu({ kod: 502 }).cozum).toContain("pm2 status");
  });

  it("özet sayar", () => {
    expect(ozetle([{ durum: "ok" }, { durum: "hata" }, { durum: "ok" }, { durum: "atla" }])).toEqual({ ok: 2, uyari: 0, hata: 1, atla: 1 });
  });
});

describe("doktor (sahte bağımlılıklarla)", () => {
  const yanit = (status, govde, basliklar = {}) => ({ status, json: async () => govde, headers: { get: (k) => basliklar[k] ?? null } });

  it("sunucu kipinde eksik sırrı, tünel kuralını ve GitHub erişimini raporlar", async () => {
    const dizin = await mkdtemp(join(tmpdir(), "atlas-doktor-"));
    const config = join(dizin, "config.yml");
    await (await import("node:fs/promises")).writeFile(config, "ingress:\n  - service: http_status:404\n");
    const fetchFn = async (url) => {
      if (url.includes("api.github.com")) return yanit(404, {});
      if (url.endsWith("/api/oturum")) return yanit(404, null, {});
      return yanit(400, {});
    };
    const { sonuclar, ozet } = await doktor({
      ayar: { ortam: "sunucu", host: "atlas.test", oturumSirri: null, portalEposta: "a@b.c", portalGirisUrl: "http://127.0.0.1:4000/api/auth/login", githubToken: "t" },
      manifest: { projeler: [{ id: "o", github: "x/ormo", repo: join(dizin, "yok") }, { id: "r", pm2: ["siparis-backend"] }] },
      kok: dizin,
      fetchFn,
      pm2Fn: async () => [{ ad: "siparis-backend", durum: "online" }],
      dnsFn: async () => ({ address: "104.21.0.1" }),
      cloudflaredConfig: config,
    });
    const bul = (ad) => sonuclar.find((s) => s.ad === ad);
    expect(bul("Oturum sırrı").durum).toBe("hata");
    expect(bul("Giriş").durum).toBe("ok");
    expect(bul("GitHub · x/ormo").mesaj).toContain("göremiyor");
    expect(bul("Cloudflare tüneli").durum).toBe("hata");
    expect(bul("Dışarıdan erişim").mesaj).toContain("Atlas'a yönlenmiyor");
    expect(bul("pm2").durum).toBe("ok");
    expect(bul("DNS").durum).toBe("ok");
    expect(ozet.hata).toBeGreaterThanOrEqual(4);
  });

  it("yerel kipte sunucuya özgü yoklamalar yapılmaz", async () => {
    const dizin = await mkdtemp(join(tmpdir(), "atlas-doktor-"));
    const { sonuclar } = await doktor({
      ayar: { ortam: "yerel", host: null, oturumSirri: null, portalEposta: null, githubToken: null },
      manifest: { projeler: [] },
      kok: dizin,
      fetchFn: async () => yanit(200, {}),
      pm2Fn: async () => null,
    });
    expect(sonuclar.map((s) => s.ad)).not.toContain("Dışarıdan erişim");
    expect(sonuclar.find((s) => s.ad === "pm2").durum).toBe("atla");
    expect(sonuclar.find((s) => s.ad === "Oturum sırrı").durum).toBe("atla");
  });
});

describe("kodAyakta", async () => {
  const { kodAyakta } = await import("../server/saglik.js");
  it("2xx/3xx ve giriş isteyen 401/403 ayakta; 404 ve 5xx değil", () => {
    for (const k of [200, 204, 301, 302, 401, 403]) expect(kodAyakta(k)).toBe(true);
    for (const k of [400, 404, 429, 500, 502, 530]) expect(kodAyakta(k)).toBe(false);
  });
});

describe("iç sağlık olayları", () => {
  const ic = (durum, kontroller = []) => ({ erisim: "ok", durum, kontroller, migration: null });
  it("durum geçişini yazar, sorunlu kontrolleri adıyla verir", () => {
    const once = { ortam: "sunucu", projeler: [{ id: "rosbel", ad: "Rosbel Portal", icDurum: ic("healthy") }] };
    const sonra = { ortam: "sunucu", projeler: [{ id: "rosbel", ad: "Rosbel Portal", icDurum: ic("unhealthy", [{ ad: "ERP veritabanı", ok: false }, { ad: "Portal veritabanı", ok: true }]) }] };
    expect(olaylariBul(once, sonra)).toEqual([{ seviye: "hata", tur: "icsaglik", projeId: "rosbel", metin: "Rosbel Portal: iç sağlık bozuk — ERP veritabanı" }]);
    expect(olaylariBul(sonra, once)[0]).toMatchObject({ seviye: "iyi", metin: "Rosbel Portal: iç sağlık düzeldi" });
  });
});
