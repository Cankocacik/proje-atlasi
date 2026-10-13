import { describe, expect, it } from "vitest";
import { akisiBirlestir, durumBul, haftalikOzet, uyarilariUret } from "../server/turet.js";
import { logSatirlariniAyristir, pathspec } from "../server/git.js";

describe("uyarilariUret", () => {
  it("elle yazılan uyarıları orta seviyeyle taşır", () => {
    const u = uyarilariUret({ uyarilar: ["Migration bekliyor"] }, null, null);
    expect(u).toEqual([{ metin: "Migration bekliyor", kaynak: "elle", seviye: "orta" }]);
  });

  it("commit edilmemiş dosya ve push edilmemiş commit uyarısı üretir", () => {
    const u = uyarilariUret({ repo: "C:/x" }, { var: true, dal: "main", degisen: 3, ileride: 2 }, null);
    expect(u.map((x) => x.metin)).toEqual(["3 dosya commit edilmedi", "2 commit push edilmedi (main)"]);
  });

  it("temiz repoda uyarı yok; upstream yoksa (null) push uyarısı çıkmaz", () => {
    expect(uyarilariUret({ repo: "C:/x" }, { var: true, dal: "main", degisen: 0, ileride: null }, null)).toEqual([]);
  });

  it("okunamayan repo ve çöken site yüksek seviyedir", () => {
    const u = uyarilariUret({ repo: "C:/yok", saglik: "https://x" }, { var: false }, { ok: false, kod: 502, ms: 80 });
    expect(u.every((x) => x.seviye === "yuksek")).toBe(true);
    expect(u[1].metin).toContain("502");
  });

  it("ağ hatasında kod yerine hata metnini yazar; yavaş site orta seviyedir", () => {
    expect(uyarilariUret({}, null, { ok: false, kod: null, hata: "zaman aşımı" })[0].metin).toContain("zaman aşımı");
    expect(uyarilariUret({}, null, { ok: true, kod: 200, ms: 4200 })[0].seviye).toBe("orta");
    expect(uyarilariUret({}, null, { ok: true, kod: 200, ms: 300 })).toEqual([]);
  });
});

describe("durumBul", () => {
  it("aşamayı renge çevirir", () => {
    expect(durumBul("canli", [])).toBe("live");
    expect(durumBul("gelistirme", [])).toBe("dev");
    expect(durumBul("bekliyor", [])).toBe("warn");
    expect(durumBul("beklemede", [])).toBe("idle");
  });
  it("orta uyarı rengi değiştirmez, yüksek uyarı kırmızıya çeker", () => {
    expect(durumBul("canli", [{ seviye: "orta" }])).toBe("live");
    expect(durumBul("canli", [{ seviye: "yuksek" }])).toBe("warn");
  });
});

describe("akisiBirlestir", () => {
  const c = (hash, tarih) => ({ hash, kisa: hash.slice(0, 3), tarih, mesaj: hash });

  it("aynı commit'i en dar kapsamlı projeye yazar ve tarihe göre sıralar", () => {
    const akis = akisiBirlestir([
      { id: "rosbel", git: { commitler: [c("aaa1", "2026-10-13T10:00:00+03:00"), c("bbb2", "2026-10-12T10:00:00+03:00")] } },
      { id: "mutabakat", kapsam: ["x"], git: { commitler: [c("aaa1", "2026-10-13T10:00:00+03:00")] } },
    ]);
    expect(akis.map((x) => [x.hash, x.projeId])).toEqual([["aaa1", "mutabakat"], ["bbb2", "rosbel"]]);
    expect(akis[0]).not.toHaveProperty("oncelik");
  });

  it("projeler sırası tersine dönse de dar kapsam kazanır", () => {
    const akis = akisiBirlestir([
      { id: "mutabakat", kapsam: ["x"], git: { commitler: [c("aaa1", "2026-10-13T10:00:00Z")] } },
      { id: "rosbel", git: { commitler: [c("aaa1", "2026-10-13T10:00:00Z")] } },
    ]);
    expect(akis[0].projeId).toBe("mutabakat");
  });

  it("git'i olmayan projeyi atlar ve sınırı uygular", () => {
    const commitler = Array.from({ length: 5 }, (_, i) => c(`h${i}`, `2026-10-0${i + 1}T00:00:00Z`));
    expect(akisiBirlestir([{ id: "a", git: null }, { id: "b", git: { commitler } }], 3)).toHaveLength(3);
  });
});

describe("haftalikOzet", () => {
  it("son 7 günü eskiden yeniye sayar, bugünü işaretler", () => {
    const simdi = new Date(2026, 9, 13, 15, 0);
    const h = haftalikOzet(
      [
        { tarih: new Date(2026, 9, 13, 9, 0).toISOString() },
        { tarih: new Date(2026, 9, 13, 11, 0).toISOString() },
        { tarih: new Date(2026, 9, 7, 9, 0).toISOString() },
        { tarih: new Date(2026, 9, 6, 9, 0).toISOString() },
      ],
      simdi,
    );
    expect(h).toHaveLength(7);
    expect(h[0]).toMatchObject({ tarih: "2026-10-07", gun: "Çar", sayi: 1, bugun: false });
    expect(h[6]).toMatchObject({ tarih: "2026-10-13", gun: "Sal", sayi: 2, bugun: true });
  });
});

describe("git yardımcıları", () => {
  it("pathspec: boş kapsamda tüm repo, hariçte '.' + exclude", () => {
    expect(pathspec()).toEqual([]);
    expect(pathspec(["a", "b"])).toEqual(["--", "a", "b"]);
    expect(pathspec([], ["tools/x"])).toEqual(["--", ".", ":(exclude)tools/x"]);
  });
  it("log satırlarını ayrıştırır", () => {
    expect(logSatirlariniAyristir("h\x1fk\x1f2026-10-13T10:00:00+03:00\x1ffeat: x | y")).toEqual([
      { hash: "h", kisa: "k", tarih: "2026-10-13T10:00:00+03:00", mesaj: "feat: x | y" },
    ]);
    expect(logSatirlariniAyristir(null)).toEqual([]);
  });
});

describe("akisSec", async () => {
  const { akisSec } = await import("../server/turet.js");
  const c = (hash, projeId, gun) => ({ hash, projeId, tarih: `2026-10-${String(gun).padStart(2, "0")}T10:00:00Z` });
  it("genel sınırın dışında kalan projenin son commitlerini de taşır, tarihe göre sıralar", () => {
    const tum = [c("a", "rosbel", 13), c("b", "rosbel", 12), c("x", "numune", 6), c("y", "numune", 5)];
    const r = akisSec(tum, ["rosbel", "numune"], { genel: 2, projeBasi: 1 });
    expect(r.map((x) => x.hash)).toEqual(["a", "b", "x"]);
  });
});
