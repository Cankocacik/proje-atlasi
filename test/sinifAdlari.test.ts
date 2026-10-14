// Reklam engelleyiciler sınıf adına bakarak öğe gizler (EasyList `##.nav-ad`): 10-14'te sol menünün
// bütün sayfa adları kullanıcının tarayıcısında boş göründü. "ad" Türkçede "isim"dir ama İngilizce
// listelerde "reklam" — sınıf adlarında `-ad`, `ad-`, `ads`, banner/sponsor/promo kullanılmaz.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const KOK = join(__dirname, "..");
const RISKLI = /(^|[-_])(ad|ads|advert|banner|sponsor|promo)([-_]|$)/i;

function siniflar(): Map<string, string> {
  const bulunan = new Map<string, string>();
  const css = readFileSync(join(KOK, "src", "styles.css"), "utf8");
  for (const m of css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) bulunan.set(m[1], "styles.css");
  const bilesenler = join(KOK, "src", "components");
  for (const dosya of [...readdirSync(bilesenler).map((d) => join(bilesenler, d)), join(KOK, "src", "App.tsx")]) {
    const kod = readFileSync(dosya, "utf8");
    for (const m of kod.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      for (const s of (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) if (s) bulunan.set(s, dosya.split(/[\\/]/).pop()!);
    }
  }
  return bulunan;
}

describe("sınıf adları", () => {
  it("reklam engelleyicinin gizlediği kalıpları içermez", () => {
    const riskli = [...siniflar()].filter(([s]) => RISKLI.test(s)).map(([s, d]) => `${s} (${d})`);
    expect(riskli).toEqual([]);
  });

  it("denetim kalıbı bilinen vakayı yakalar", () => {
    expect(RISKLI.test("nav-ad")).toBe(true);
    expect(RISKLI.test("ad-slot")).toBe(true);
    expect(RISKLI.test("nav-metin")).toBe(false);
    expect(RISKLI.test("yayin-adimlari")).toBe(false);
  });
});
