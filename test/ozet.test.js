import { describe, expect, it } from "vitest";
import { gunlukOzet, ozetZamaniMi, saatCoz } from "../server/ozet.js";

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
