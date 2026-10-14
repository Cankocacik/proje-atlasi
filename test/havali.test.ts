// Arayüzün yeni saf yardımcıları: canlı göstergeler, komut paleti araması, ok tuşu gezinmesi, sekme simgesi.
import { describe, expect, it } from "vitest";
import type { Proje, Surec } from "../src/types";
import { durumCumlesi, vitaller } from "../src/lib/durumOzeti";
import { katla, paletAra } from "../src/lib/palet";
import { yondekiKomsu } from "../src/lib/komsu";
import { faviconSvg } from "../src/lib/favicon";

const proje = (ek: Partial<Proje>): Proje => ({
  id: "p", ad: "P", tur: "", ikon: "tool", asama: "canli", asamaSira: 4, konum: { x: 0, y: 0 },
  durum: "live", uyarilar: [], git: null, saglik: null, ...ek,
});
const surec = (ad: string, durum: string, sonSaatYenidenBaslama = 0): Surec => ({
  ad, id: 0, durum, calismaSn: 1, yenidenBaslama: 0, sonSaatYenidenBaslama, hata15: 0, bellekMb: null, cpu: null,
});

describe("vitaller", () => {
  const projeler = [
    proje({ id: "r", saglik: { ok: true, kod: 200, ms: 300 }, git: { var: true, geride: 2, degisen: 1, ileride: 0, bekleyen: { toplam: 2, commitler: [], dosyaSayisi: 3, adimlar: [] } } }),
    proje({ id: "r-mod", kapsam: ["x/"], git: { var: true, geride: 1, degisen: 5 } }), // modül: repo sayılmaz
    proje({ id: "m", saglik: { ok: false, kod: 502, ms: null }, uyarilar: [{ metin: "Site yanıt vermiyor", kaynak: "saglik", seviye: "yuksek" }], git: { var: true, geride: 0, degisen: 0, ileride: 3 } }),
    proje({ id: "t", uyarilar: [{ metin: "not", kaynak: "elle", seviye: "orta" }] }),
  ];

  it("site, süreç, repo, dikkat ve adımları gerçek alanlardan sayar", () => {
    const v = vitaller({
      projeler,
      surecler: [surec("a", "online", 2), surec("b", "errored")],
      adimlar: [{ id: "1", metin: "", etiket: "engel", projeId: "r", tamam: false }, { id: "2", metin: "", etiket: "sirada", projeId: "r", tamam: true }],
    });
    expect(v.siteler).toEqual({ ayakta: 1, toplam: 2, ortMs: 300 });
    expect(v.surecler).toEqual({ calisan: 1, toplam: 2, yenidenBaslama: 2 });
    expect(v.repolar).toEqual({ toplam: 2, guncel: 1, geride: 2, yerelDegisen: 1, yerelIleride: 3, kirli: 2 });
    expect(v.dikkat).toEqual({ sorun: 1, not: 1, temiz: 2, toplam: 4 });
    expect(v.adimlar).toEqual({ tamam: 1, toplam: 2, engel: 1 });
    expect(v.genel).toBe("sorun");
    expect(durumCumlesi(v)).toBe("1 sistem sorunlu · 1/2 site yanıt vermiyor · 1 süreç durmuş · 1 açık not");
  });

  it("PC'de süreç yok; uyarısız ekran temiz", () => {
    const v = vitaller({ projeler: [proje({ saglik: { ok: true, kod: 200, ms: 120 } })], surecler: null, adimlar: [] });
    expect(v.surecler).toBeNull();
    expect(v.genel).toBe("temiz");
    expect(durumCumlesi(v)).toBe("1 sitenin hepsi ayakta");
  });
});

describe("paletAra", () => {
  const ogeler = [
    { ad: "Rosbel Portal" }, { ad: "Olay günlüğü" }, { ad: "Mutabiko", anahtar: "mutabakat ürün" },
    { ad: "Şimdi tara" }, { ad: "Iceinox Servis" }, { ad: "Cari Mutabakat" },
  ];
  it("Türkçe harf/aksan katlanır", () => {
    expect(katla("Günlüğü İŞIK")).toBe("gunlugu isik");
    expect(paletAra(ogeler, "olay gunlugu").map((o) => o.ad)).toEqual(["Olay günlüğü"]);
    expect(paletAra(ogeler, "simdi").map((o) => o.ad)).toEqual(["Şimdi tara"]);
  });
  it("baştan eşleşme > kelime başı > içerir > ek anahtar > sıralı harf", () => {
    expect(paletAra(ogeler, "muta").map((o) => o.ad)).toEqual(["Mutabiko", "Cari Mutabakat"]);
    expect(paletAra(ogeler, "ürün").map((o) => o.ad)).toEqual(["Mutabiko"]);
    expect(paletAra(ogeler, "rsbl").map((o) => o.ad)).toEqual(["Rosbel Portal"]);
    expect(paletAra(ogeler, "").length).toBe(ogeler.length);
    expect(paletAra(ogeler, "zzz")).toEqual([]);
  });
});

describe("yondekiKomsu", () => {
  const n = [
    { id: "merkez", x: 100, y: 100 },
    { id: "sag", x: 200, y: 110 },
    { id: "sag-asagi", x: 160, y: 200 },
    { id: "ust", x: 95, y: 10 },
    { id: "sol", x: 10, y: 90 },
  ];
  it("yöndeki en yakın düğüm; yan sapma ağır cezalanır", () => {
    expect(yondekiKomsu(n, "merkez", "sag")).toBe("sag");
    expect(yondekiKomsu(n, "merkez", "asagi")).toBe("sag-asagi");
    expect(yondekiKomsu(n, "merkez", "yukari")).toBe("ust");
    expect(yondekiKomsu(n, "merkez", "sol")).toBe("sol");
  });
  it("o yönde düğüm yoksa null", () => {
    expect(yondekiKomsu(n, "sag", "sag")).toBeNull();
    expect(yondekiKomsu(n, "yok", "sag")).toBeNull();
  });
});

describe("faviconSvg", () => {
  it("sorunda kırmızı nokta, temizde nokta yok; bozuk vurgu rengi varsayılana döner", () => {
    const temiz = decodeURIComponent(faviconSvg("temiz", "#C6F24E"));
    const sorun = decodeURIComponent(faviconSvg("sorun", "red;}<script>"));
    expect(temiz).not.toContain("#F67F65");
    expect(sorun).toContain("#F67F65");
    expect(sorun).not.toContain("<script>");
    expect(sorun).toContain("#C6F24E");
  });
});

describe("duvar modu turu", () => {
  it("sorunlu → notlu → kart → modül; sonuncudan başa döner", async () => {
    const { turSirasi, turdakiSonraki } = await import("../src/lib/durumOzeti");
    const sira = turSirasi([
      proje({ id: "modul" }),
      proje({ id: "kart", kart: true }),
      proje({ id: "not", uyarilar: [{ metin: "n", kaynak: "elle", seviye: "orta" }] }),
      proje({ id: "sorun", uyarilar: [{ metin: "s", kaynak: "saglik", seviye: "yuksek" }] }),
    ]);
    expect(sira).toEqual(["sorun", "not", "kart", "modul"]);
    expect(turdakiSonraki(sira, "kart")).toBe("modul");
    expect(turdakiSonraki(sira, "modul")).toBe("sorun");
    expect(turdakiSonraki(sira, "silinmis")).toBe("sorun");
    expect(turdakiSonraki([], null)).toBeNull();
  });
});
