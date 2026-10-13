import { describe, expect, it } from "vitest";
import { dirsekYol, kutuBul, HUB_YUKSEKLIK } from "../src/lib/geometri";
import { gunFarki, goreli } from "../src/lib/zaman";

describe("kutuBul", () => {
  it("nokta düğüm sıfır boyutludur, hub kartı daha yüksektir", () => {
    expect(kutuBul({ ikon: "module", konum: { x: 10, y: 20 } })).toEqual({ x: 10, y: 20, w: 0, h: 0 });
    expect(kutuBul({ kart: true, ikon: "hub", konum: { x: 0, y: 0, w: 212 } }).h).toBe(HUB_YUKSEKLIK);
  });
});

describe("dirsekYol", () => {
  it("yatay ağırlıkta kartın sağ kenarından karşı kartın sol kenarına H-V-H çizer", () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    const b = { x: 300, y: 40, w: 100, h: 100 };
    const { d, etiket } = dirsekYol(a, b);
    expect(d).toBe("M100 50 H200 V90 H300");
    expect(etiket).toEqual({ x: 200, y: 70 });
  });

  it("dikey ağırlıkta alt kenardan üst kenara V-H-V çizer; nokta düğümde merkezi kullanır", () => {
    const kart = { x: 0, y: 0, w: 100, h: 100 };
    const nokta = { x: 60, y: 300, w: 0, h: 0 };
    expect(dirsekYol(kart, nokta).d).toBe("M50 100 V200 H60 V300");
  });
});

describe("zaman", () => {
  const simdi = new Date(2026, 9, 13, 10, 0);
  it("takvim günü farkı saatten bağımsızdır", () => {
    expect(gunFarki(new Date(2026, 9, 12, 23, 59).toISOString(), simdi)).toBe(1);
    expect(gunFarki(new Date(2026, 9, 13, 0, 1).toISOString(), simdi)).toBe(0);
  });
  it("göreli metin", () => {
    expect(goreli(null, simdi)).toBe("kayıt yok");
    expect(goreli(new Date(2026, 9, 13, 9, 30).toISOString(), simdi)).toBe("30 dk önce");
    expect(goreli(new Date(2026, 9, 13, 7, 0).toISOString(), simdi)).toBe("3 sa önce");
    expect(goreli(new Date(2026, 9, 12, 7, 0).toISOString(), simdi)).toBe("dün");
    expect(goreli(new Date(2026, 9, 3, 7, 0).toISOString(), simdi)).toBe("10 gün önce");
  });
});
