import { describe, expect, it } from "vitest";
import { disariMetin, gunlukOzet, ozetZamaniMi, saatCoz } from "../server/ozet.js";

describe("saatCoz / ozetZamaniMi", () => {
  it("HH:MM okur, geçersizi reddeder", () => {
    expect(saatCoz("08:30")).toEqual({ saat: 8, dakika: 30 });
    expect(saatCoz(" 7:05 ")).toEqual({ saat: 7, dakika: 5 });
    expect(saatCoz("24:00")).toBeNull();
    expect(saatCoz("sabah")).toBeNull();
    expect(saatCoz(undefined)).toBeNull();
  });

  it("saat geçmiş ve bugün gönderilmemişse zamanı gelmiştir", () => {
    const hedef = { saat: 8, dakika: 30 };
    expect(ozetZamaniMi(hedef, null, new Date(2026, 9, 14, 8, 29))).toBe(false);
    expect(ozetZamaniMi(hedef, null, new Date(2026, 9, 14, 8, 30))).toBe(true);
    expect(ozetZamaniMi(hedef, "2026-10-14", new Date(2026, 9, 14, 12, 0))).toBe(false);
    expect(ozetZamaniMi(hedef, "2026-10-13", new Date(2026, 9, 14, 12, 0))).toBe(true);
    expect(ozetZamaniMi(null, null, new Date())).toBe(false);
  });
});

describe("gunlukOzet", () => {
  const simdi = new Date(2026, 9, 14, 8, 30);
  const p = (id, ad, ek = {}) => ({ id, ad, uyarilar: [], git: null, saglikGecmisi: null, ...ek });

  it("sorunları önce yüksek, canlıya bekleyeni ve %100 altı erişimi yazar", () => {
    const m = gunlukOzet({
      ortam: "sunucu",
      projeler: [
        p("rosbel", "Rosbel Portal", {
          uyarilar: [{ seviye: "orta", metin: "Defterde 2 migration bekliyor" }],
          git: { geride: 3, bekleyen: { commitler: [{}, {}, {}] } },
          saglikGecmisi: { yuzde: 100 },
        }),
        p("ormo", "ORMO Gümrük", { uyarilar: [{ seviye: "yuksek", metin: "Site yanıt vermiyor (530)" }], saglikGecmisi: { yuzde: 0 } }),
        p("mutabakat", "Cari Mutabakat", { kapsam: ["x"], git: { geride: 1, bekleyen: { commitler: [{}] } } }),
      ],
      olaylar: [
        { zaman: new Date(2026, 9, 14, 3, 0).toISOString(), seviye: "hata" },
        { zaman: new Date(2026, 9, 14, 4, 0).toISOString(), seviye: "iyi" },
        { zaman: new Date(2026, 9, 12, 4, 0).toISOString(), seviye: "hata" },
      ],
    }, { simdi, host: "atlas.rosbelportal.com" });
    expect(m).toBe([
      "Proje Atlası — günlük özet (14.10)",
      "",
      "Dikkat: 2 proje / modül",
      "✗ ORMO Gümrük: Site yanıt vermiyor (530)",
      "! Rosbel Portal: Defterde 2 migration bekliyor",
      "",
      "Canlıya bekleyen: Rosbel Portal 3 commit",
      "",
      "Erişim (24 sa): ORMO Gümrük %0",
      "",
      "Son 24 saat: 2 olay (1 sorun)",
      "",
      "https://atlas.rosbelportal.com",
    ].join("\n"));
  });

  it("her şey yolundaysa kısa", () => {
    expect(gunlukOzet({ ortam: "yerel", projeler: [p("a", "A")], olaylar: [] }, { simdi })).toBe("Proje Atlası — günlük özet (14.10)\n\n✓ Dikkat bekleyen iş yok.");
  });
});

describe("disariMetin", () => {
  it("iç sağlık / kurulum / git ayrıntısı Telegram'a gitmez; elle not olduğu gibi gider", () => {
    expect(disariMetin({ kaynak: "icsaglik", metin: "ERP veritabanı yanıt vermiyor — connect ETIMEDOUT 10.0.0.5:3306" })).toBe("ERP veritabanı yanıt vermiyor");
    expect(disariMetin({ kaynak: "icsaglik", metin: "İç sağlık ucuna ulaşılamıyor (ECONNREFUSED)" })).toBe("İç sağlık ucuna ulaşılamıyor");
    expect(disariMetin({ kaynak: "denetim", metin: "Kurulum · Repo: proje-atlasi: fatal: could not read Username" })).toBe("Kurulum · Repo");
    expect(disariMetin({ kaynak: "git", metin: "GitHub okunamadı (HTTP 401 Bad credentials)" })).toBe("GitHub okunamadı");
    expect(disariMetin({ kaynak: "elle", metin: "Numune migration'ları (2 adet) bekliyor" })).toBe("Numune migration'ları (2 adet) bekliyor");
  });

  it("günlük özet satırları ayrıntısız yazılır", () => {
    const m = gunlukOzet({ projeler: [{ id: "r", ad: "Rosbel", uyarilar: [{ kaynak: "icsaglik", seviye: "yuksek", metin: "Redis yanıt vermiyor — ECONNREFUSED 127.0.0.1:6379" }] }] });
    expect(m).toContain("✗ Rosbel: Redis yanıt vermiyor");
    expect(m).not.toContain("6379");
  });
});
