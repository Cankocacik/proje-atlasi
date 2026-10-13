import { describe, expect, it } from "vitest";
import { hataImzasi, hataOzeti } from "../src/lib/hataOzeti";
import type { LogSatiri } from "../src/types";

const satir = (metin: string, ek: Partial<LogSatiri> = {}): LogSatiri => ({ zaman: "2026-10-14T10:00:00.000Z", akim: "err", hata: true, metin, ...ek });

describe("hataImzasi", () => {
  it("zaman damgası, uuid, kimlik ve sayıları ayıklar", () => {
    expect(hataImzasi("2026-10-14T10:00:01: ERROR konfeksiyon-db timeout (1500ms) order 4512"))
      .toBe("ERROR konfeksiyon-db timeout (‹n›ms) order ‹n›");
    expect(hataImzasi("[2026-10-14 10:00:01] istek 3f2b9c1e-1111-4a2b-9c3d-0123456789ab başarısız, jti a1b2c3d4e5f6a7b8"))
      .toBe("istek ‹uuid› başarısız, jti ‹id›");
  });

  it("aynı hatanın farklı değerli tekrarları aynı imzayı verir", () => {
    expect(hataImzasi("ECONNREFUSED 127.0.0.1:3306")).toBe(hataImzasi("ECONNREFUSED 127.0.0.1:3307"));
  });
});

describe("hataOzeti", () => {
  it("hata satırlarını imzaya göre sayar, en sık olan önce; yığın izi satırlarını saymaz", () => {
    const r = hataOzeti([
      satir("Error: ER_LOCK_WAIT_TIMEOUT order 12", { zaman: "2026-10-14T10:00:00.000Z" }),
      satir("    at Query.run (C:/app/db.js:44:9)"),
      satir("Error: ER_LOCK_WAIT_TIMEOUT order 13", { zaman: "2026-10-14T10:05:00.000Z" }),
      satir("}"),
      satir("SMTP bağlantısı koptu"),
      satir("normal satır", { hata: false }),
    ]);
    expect(r.map((g) => [g.imza, g.sayi])).toEqual([
      ["Error: ER_LOCK_WAIT_TIMEOUT order ‹n›", 2],
      ["SMTP bağlantısı koptu", 1],
    ]);
    expect(r[0].ornek).toBe("Error: ER_LOCK_WAIT_TIMEOUT order 13");
    expect(r[0].son).toBe("2026-10-14T10:05:00.000Z");
  });

  it("Atlas açılmadan önceki satırın zamanı bilinmez", () => {
    expect(hataOzeti([satir("eski hata", { gecmis: true })])[0].son).toBeNull();
  });

  it("sınırı uygular", () => {
    const satirlar = Array.from({ length: 8 }, (_, i) => satir(`hata türü ${"x".repeat(i)}`));
    expect(hataOzeti(satirlar, 3)).toHaveLength(3);
  });
});
