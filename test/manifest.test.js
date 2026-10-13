import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { manifestDogrula } from "../server/manifest.js";
import { uyarilariUret } from "../server/turet.js";

const dugum = (ek) => ({ id: "a", ad: "A", asama: "canli", ikon: "module", konum: { x: 10, y: 10 }, ...ek });
const mesajlar = (m, simdi) => manifestDogrula(m, simdi).map((s) => `${s.seviye}|${s.yer}|${s.mesaj}`);

describe("manifestDogrula", () => {
  it("repodaki projeler.json'da hata yok", () => {
    const m = JSON.parse(readFileSync(new URL("../projeler.json", import.meta.url), "utf8"));
    expect(manifestDogrula(m, new Date("2026-10-14")).filter((s) => s.seviye === "hata")).toEqual([]);
  });

  it("projeler dizisi yoksa tek hata", () => {
    expect(mesajlar({})).toEqual(["hata|projeler|\"projeler\" dizisi yok"]);
  });

  it("yazım hatalarını yakalar: aşama, tekrar eden id, eksik konum, bozuk adres", () => {
    const m = {
      projeler: [
        dugum({ asama: "canlı" }),
        dugum({ ad: "B" }),
        dugum({ id: "c", konum: {} }),
        dugum({ id: "d", saglik: "rosbelportal.com", github: "sadece-ad" }),
      ],
    };
    const r = mesajlar(m);
    expect(r).toContain('hata|projeler › a|asama "canlı" geçersiz — fikir · gelistirme · bekliyor · canli · beklemede');
    expect(r).toContain("hata|projeler › a|aynı id iki kez kullanılmış");
    expect(r).toContain("hata|projeler › c|konum.x / konum.y sayı olmalı");
    expect(r).toContain("hata|projeler › d|saglik geçerli bir http(s) adresi değil");
    expect(r).toContain('hata|projeler › d|github "sahip/repo" biçiminde olmalı');
  });

  it("olmayan üst ve akış uçlarını, tekrar eden adım kimliğini bulur", () => {
    const m = {
      projeler: [dugum({ ust: "yok", adimlar: [{ id: "x", metin: "1" }, { id: "x", metin: "2" }, { id: "y", metin: "3", etiket: "acil" }] })],
      akislar: [{ kaynak: "a", hedef: "hayalet" }],
    };
    const r = mesajlar(m);
    expect(r).toContain('hata|projeler › a|ust "yok" diye bir düğüm yok');
    expect(r).toContain('hata|akislar[0]|hedef "hayalet" diye bir düğüm yok');
    expect(r).toContain('hata|projeler › a|adım id "x" tekrarlanmış');
    expect(r).toContain('uyari|projeler › a|adım "y" etiketi "acil" — engel · sirada');
  });

  it("harita dışı konumu ve üst üste binen kartları uyarı sayar", () => {
    const m = {
      harita: { genislik: 780, yukseklik: 540 },
      projeler: [
        dugum({ id: "k1", ad: "Bir", kart: true, konum: { x: 10, y: 10, w: 190 } }),
        dugum({ id: "k2", ad: "İki", kart: true, konum: { x: 100, y: 60, w: 190 } }),
        dugum({ id: "uzak", konum: { x: 900, y: 10 } }),
      ],
    };
    const r = mesajlar(m);
    expect(r).toContain('uyari|harita|"Bir" ve "İki" kartları üst üste biniyor');
    expect(r).toContain("uyari|projeler › uzak|konum haritanın dışında (780×540)");
  });

  it("21 gündür duran elle uyarıyı sorgular; tarihsiz ve taze notu geçer", () => {
    const m = {
      projeler: [dugum({ uyarilar: ["tarihsiz", { metin: "taze", tarih: "2026-10-10" }, { metin: "bayat", tarih: "2026-09-01" }, { metin: "bozuk", tarih: "dün" }] })],
    };
    const r = mesajlar(m, new Date("2026-10-14T12:00:00Z"));
    expect(r).toEqual([
      'uyari|projeler › a|elle uyarı 43 gündür duruyor — hâlâ geçerli mi? "bayat"',
      'hata|projeler › a|uyarı tarihi okunamadı: "dün"',
    ]);
  });
});

describe("elle uyarı biçimleri", () => {
  it("düz metin ve nesne (tarih/seviye) birlikte okunur", () => {
    const u = uyarilariUret({ uyarilar: ["düz", { metin: "tarihli", tarih: "2026-10-13" }, { metin: "acil", seviye: "yuksek" }, { tarih: "boş" }] }, null, null);
    expect(u).toEqual([
      { metin: "düz", kaynak: "elle", seviye: "orta" },
      { metin: "tarihli", kaynak: "elle", seviye: "orta", tarih: "2026-10-13" },
      { metin: "acil", kaynak: "elle", seviye: "yuksek" },
    ]);
  });
});

describe("ters bölü kaçışı", () => {
  it("JSON'da backspace'e dönüşmüş yolu yakalar", () => {
    // JSON metninde C:\backend yazılmış gibi: ayrıştırınca \b backspace olur.
    const ters = String.fromCharCode(92);
    const metin = `{"projeler":[{"id":"a","ad":"A","asama":"canli","ikon":"module","konum":{"x":1,"y":1},"repo":"C:${ters}backend","yayin":{"adimlar":[{"yol":"","adim":"cd C:${ters}backend; git pull"}]}}]}`;
    const m = JSON.parse(metin);
    expect(m.projeler[0].repo).toBe("C:\u0008ackend");
    const r = manifestDogrula(m).map((s) => s.mesaj);
    expect(r.some((x) => x.startsWith("repo: kontrol karakteri"))).toBe(true);
    expect(r.some((x) => x.startsWith("yayin.adimlar[0]: kontrol karakteri"))).toBe(true);
  });
});

describe("güvenli yayın kuralları", () => {
  const proje = (ek) => ({ projeler: [{ id: "x", ad: "X", asama: "canli", ikon: "tool", konum: { x: 10, y: 10 }, ...ek }] });
  const mesajlar = (m) => manifestDogrula(m).map((s) => `${s.seviye}: ${s.mesaj}`);

  it("token'lı iç sağlık adresi bu makine dışında olamaz", () => {
    expect(mesajlar(proje({ icSaglik: { url: "https://ornek.example/health", tokenEnv: "T" } })).join("\n")).toMatch(/hata: icSaglik.url bu makinenin adresi/);
    expect(mesajlar(proje({ icSaglik: { url: "http://127.0.0.1:4000/api/health/detailed", tokenEnv: "T" } }))).toEqual([]);
  });

  it("git pull --ff-only'siz ve doğrudan migrate uyarı verir; dur boolean olmalı", () => {
    const m = mesajlar(proje({ yayin: { adimlar: [
      { yol: "", adim: "cd C:/x; git pull" },
      { yol: "m/", adim: "cd C:/x; npm run migrate", dur: "evet" },
      { yol: "m/", adim: "npm run migrate:verify", dur: true },
    ] } }));
    expect(m).toEqual([
      expect.stringMatching(/uyari: yayin.adimlar\[0\]: git pull --ff-only/),
      expect.stringMatching(/hata: yayin.adimlar\[1\]: dur true\/false/),
      expect.stringMatching(/uyari: yayin.adimlar\[1\]: doğrudan migrate/),
    ]);
  });
});
