import { describe, expect, it } from "vitest";
import type { Adim, Proje } from "../src/types";
import { projeIlerlemesi, projeKapsami } from "../src/lib/ilerleme";

const proje = (id: string, ust?: string) => ({ id, ust } as Proje);
const adim = (id: string, projeId: string, tamam: boolean) => ({ id, projeId, tamam } as Adim);

describe("proje ilerlemesi", () => {
  it("ana projenin tüm alt modüllerini sayar, bağımsız projeleri dışarıda tutar", () => {
    const veri = {
      projeler: [proje("portal"), proje("finans", "portal"), proje("rapor", "finans"), proje("baska")],
      adimlar: [adim("1", "portal", true), adim("2", "finans", false), adim("3", "rapor", true), adim("4", "baska", false)],
    };
    expect(projeIlerlemesi(veri, "portal")).toMatchObject({ tamam: 2, toplam: 3, yuzde: 67 });
    expect(projeIlerlemesi(veri, "finans")).toMatchObject({ tamam: 1, toplam: 2, yuzde: 50 });
  });

  it("tanımlı adım yoksa yüzde üretmez; tanımlı ama tamamlanmamış adım sıfırdır", () => {
    expect(projeIlerlemesi({ projeler: [], adimlar: [] }, "portal").yuzde).toBeNull();
    expect(projeIlerlemesi({ projeler: [proje("portal")], adimlar: [adim("1", "portal", false)] }, "portal").yuzde).toBe(0);
  });

  it("döngü ve sırasız bir manifestte projeleri bir kez kapsar", () => {
    const projeler = [proje("torun", "cocuk"), proje("cocuk", "ana"), proje("ana", "torun"), proje("bagimsiz")];
    expect([...projeKapsami(projeler, "ana")].sort()).toEqual(["ana", "cocuk", "torun"]);
  });
});
