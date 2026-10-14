import { describe, expect, it } from "vitest";
import { kopyaParcalari, zincir } from "../src/lib/yayinKomutu";

const adim = (adim: string, ek: { dur?: boolean; bilgi?: boolean } = {}) => ({ adim, dosya: 1, ornek: [], ...ek });

describe("zincir", () => {
  it("her komut yalnız öncekisi başarılıysa çalışır (PowerShell 5.1)", () => {
    expect(zincir(["git pull --ff-only", "npm install", "pm2 restart x"])).toBe(
      "git pull --ff-only; if ($?) { npm install; if ($?) { pm2 restart x } }",
    );
  });
  it("tek komut olduğu gibi kalır; boş liste boş metin", () => {
    expect(zincir(["git pull --ff-only"])).toBe("git pull --ff-only");
    expect(zincir([])).toBe("");
  });
});

describe("kopyaParcalari", () => {
  it("karar noktası parçayı kapatır; bilgi satırı komut değildir", () => {
    const parcalar = kopyaParcalari([
      adim("cd C:/r; git pull --ff-only"),
      adim("npm install"),
      adim("npm run migrate:verify", { dur: true }),
      adim("pm2 restart siparis-backend --update-env"),
      adim("Frontend Vercel'de", { bilgi: true }),
    ]);
    expect(parcalar).toEqual([
      ["cd C:/r; git pull --ff-only", "npm install", "npm run migrate:verify"],
      ["pm2 restart siparis-backend --update-env"],
    ]);
  });
  it("karar noktası yoksa tek parça; son adım karar noktasıysa boş parça açılmaz", () => {
    expect(kopyaParcalari([adim("a"), adim("b")])).toEqual([["a", "b"]]);
    expect(kopyaParcalari([adim("a"), adim("b", { dur: true })])).toEqual([["a", "b"]]);
  });
});
