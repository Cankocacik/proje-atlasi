import { describe, expect, it } from "vitest";
import { bildirilir, kutuAraligi, olayZamani, yeniOlaylar } from "../src/lib/olay";
import type { Olay } from "../src/types";

const olay = (id: number, ek: Partial<Olay> = {}): Olay => ({ id, zaman: "2026-10-14T09:00:00Z", seviye: "bilgi", tur: "commit", metin: `o${id}`, ...ek });

describe("yeniOlaylar", () => {
  it("ilk yüklemede geçmişi bildirmez, yalnız en büyük kimliği hatırlar", () => {
    expect(yeniOlaylar([olay(3), olay(2)], null)).toEqual({ yeniler: [], enBuyuk: 3 });
  });

  it("sonradan gelenleri eskiden yeniye döndürür", () => {
    const r = yeniOlaylar([olay(6), olay(5), olay(3)], 3);
    expect(r.yeniler.map((o) => o.id)).toEqual([5, 6]);
    expect(r.enBuyuk).toBe(6);
  });

  it("boş listede son görülen korunur", () => {
    expect(yeniOlaylar(undefined, 4)).toEqual({ yeniler: [], enBuyuk: 4 });
  });
});

describe("bildirilir", () => {
  it("düşüş ve geri gelişler bildirilir; commit ve bilgi bildirilmez", () => {
    expect(bildirilir(olay(1, { seviye: "hata", tur: "site" }))).toBe(true);
    expect(bildirilir(olay(1, { seviye: "iyi", tur: "surec" }))).toBe(true);
    expect(bildirilir(olay(1, { seviye: "iyi", tur: "yayin" }))).toBe(false);
    expect(bildirilir(olay(1, { seviye: "bilgi", tur: "commit" }))).toBe(false);
    expect(bildirilir(olay(1, { seviye: "uyari", tur: "surec" }))).toBe(false);
  });
});

describe("zaman metinleri", () => {
  const simdi = new Date(2026, 9, 14, 15, 0);
  it("bugünse yalnız saat, değilse gün.ay + saat", () => {
    expect(olayZamani(new Date(2026, 9, 14, 9, 5).toISOString(), simdi)).toBe("09:05");
    expect(olayZamani(new Date(2026, 9, 13, 23, 40).toISOString(), simdi)).toBe("13.10 23:40");
  });
  it("son kutu şimdiye biter, ilk kutu 24 saat önce başlar", () => {
    expect(kutuAraligi(47, 48, simdi)).toBe("14:30–15:00");
    expect(kutuAraligi(0, 48, simdi)).toBe("15:00–15:30");
  });
});
