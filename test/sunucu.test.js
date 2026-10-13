import { describe, expect, it } from "vitest";
import { appendFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cerezOku, denemeSiniri, jetonCoz, jetonUret, parolaDogru, parolaOzeti } from "../server/kimlik.js";
import { jlistCevir, logIzleyici, yenidenBaslamaIzleyici } from "../server/pm2.js";
import { istekUygun, uzakMi } from "../server/api.js";
import { uyarilariUret } from "../server/turet.js";
import { githubCommitCevir } from "../server/github.js";
import { ortamOku } from "../server/ortam.js";

const SIR = "x".repeat(40);

describe("parola", () => {
  it("özet doğrular, yanlış parolayı ve bozuk kaydı reddeder", async () => {
    const ozet = await parolaOzeti("çok-gizli-parola-123");
    expect(ozet.startsWith("scrypt$")).toBe(true);
    expect(await parolaDogru("çok-gizli-parola-123", ozet)).toBe(true);
    expect(await parolaDogru("yanlis", ozet)).toBe(false);
    expect(await parolaDogru("", ozet)).toBe(false);
    expect(await parolaDogru("x", "bozuk")).toBe(false);
    expect(await parolaDogru(undefined, ozet)).toBe(false);
  });
});

describe("oturum jetonu", () => {
  it("imzalı jetonu çözer; süresi dolmuş, başka sırla imzalanmış ya da kurcalanmış jetonu reddeder", () => {
    const t0 = Date.UTC(2026, 9, 13);
    const j = jetonUret(SIR, 3600, t0);
    expect(jetonCoz(j, SIR, t0 + 1000)).toMatchObject({ exp: t0 / 1000 + 3600 });
    expect(jetonCoz(j, SIR, t0 + 3601_000)).toBeNull();
    expect(jetonCoz(j, "y".repeat(40), t0)).toBeNull();
    const [govde, imza] = j.split(".");
    const sahte = Buffer.from(JSON.stringify({ exp: 9e9, sid: "x" })).toString("base64url");
    expect(jetonCoz(`${sahte}.${imza}`, SIR, t0)).toBeNull();
    expect(jetonCoz(`${govde}.`, SIR, t0)).toBeNull();
    expect(jetonCoz(null, SIR, t0)).toBeNull();
    expect(jetonCoz(j, null, t0)).toBeNull();
  });

  it("çerez başlığından değeri okur", () => {
    expect(cerezOku("a=1; atlas_oturum=abc.def; b=2", "atlas_oturum")).toBe("abc.def");
    expect(cerezOku(undefined, "atlas_oturum")).toBeNull();
  });
});

describe("deneme sınırı", () => {
  it("IP başına 5 başarısız denemeden sonra kilitler, pencere geçince açar", () => {
    const s = denemeSiniri();
    for (let i = 0; i < 5; i++) {
      expect(s.izinli("1.1.1.1", 1000)).toBe(true);
      s.basarisiz("1.1.1.1", 1000);
    }
    expect(s.izinli("1.1.1.1", 1000)).toBe(false);
    expect(s.izinli("2.2.2.2", 1000)).toBe(true);
    expect(s.izinli("1.1.1.1", 1000 + 15 * 60_000 + 1)).toBe(true);
  });

  it("farklı IP'lerden gelen toplam denemeyi de sınırlar", () => {
    const s = denemeSiniri({ genelSinir: 3 });
    for (let i = 0; i < 3; i++) s.basarisiz(`10.0.0.${i}`, 0);
    expect(s.izinli("10.0.0.99", 1)).toBe(false);
  });
});

const istek = (ek = {}) => ({
  method: "GET",
  headers: { host: "127.0.0.1:4321", ...ek.headers },
  socket: { remoteAddress: ek.soket ?? "127.0.0.1" },
  ...("method" in ek ? { method: ek.method } : {}),
});

describe("istek kapıları", () => {
  it("doğrudan yerel istek uzak sayılmaz; Cloudflare'den gelen her zaman uzaktır", () => {
    expect(uzakMi(istek())).toBe(false);
    expect(uzakMi(istek({ headers: { "cf-connecting-ip": "8.8.8.8" } }))).toBe(true);
    expect(uzakMi(istek({ headers: { host: "atlas.rosbelportal.com" } }))).toBe(true);
    expect(uzakMi(istek({ soket: "192.168.1.20" }))).toBe(true);
  });

  it("yalnız yerel ve tanımlı host kabul edilir", () => {
    expect(istekUygun(istek(), "atlas.rosbelportal.com")).toBe(true);
    expect(istekUygun(istek({ headers: { host: "atlas.rosbelportal.com" } }), "atlas.rosbelportal.com")).toBe(true);
    expect(istekUygun(istek({ headers: { host: "kotu.example" } }), "atlas.rosbelportal.com")).toBe(false);
    expect(istekUygun(istek({ headers: { host: "kotu.example" } }), null)).toBe(false);
  });

  it("yazma isteği özel başlık ve aynı köken ister", () => {
    const post = (headers) => istek({ method: "POST", headers: { host: "atlas.rosbelportal.com", ...headers } });
    expect(istekUygun(post({}), "atlas.rosbelportal.com")).toBe(false);
    expect(istekUygun(post({ "x-atlas": "1", origin: "https://atlas.rosbelportal.com" }), "atlas.rosbelportal.com")).toBe(true);
    expect(istekUygun(post({ "x-atlas": "1", origin: "https://kotu.example" }), "atlas.rosbelportal.com")).toBe(false);
  });
});

describe("ortam", () => {
  it("varsayılan yereldir; sunucu ayarlarını okur", () => {
    expect(ortamOku({}).ortam).toBe("yerel");
    const o = ortamOku({ ATLAS_ORTAM: "sunucu", ATLAS_HOST: " Atlas.RosbelPortal.com ", ATLAS_OTURUM_GUN: "3" });
    expect(o).toMatchObject({ ortam: "sunucu", host: "atlas.rosbelportal.com", oturumGun: 3, parolaOzeti: null });
  });
});

describe("sunucu uyarıları", () => {
  it("sunucuda geride kalan commit 'canlıya alınmadı', yerelde 'çekilmedi' olur", () => {
    const git = { var: true, dal: "main", degisen: 0, ileride: 0, geride: 3 };
    expect(uyarilariUret({}, git, null, { ortam: "sunucu" })[0].metin).toBe("3 commit canlıya alınmadı");
    expect(uyarilariUret({}, git, null, { ortam: "yerel" })[0].metin).toBe("3 commit çekilmedi (git pull)");
  });

  it("GitHub okunamazsa orta, yerel repo okunamazsa yüksek seviye", () => {
    expect(uyarilariUret({}, { var: false, kaynak: "github", hata: "GitHub 401" }, null)[0]).toMatchObject({ seviye: "orta", metin: "GitHub okunamadı (GitHub 401)" });
    expect(uyarilariUret({ repo: "C:/x" }, { var: false, kaynak: "git" }, null)[0].seviye).toBe("yuksek");
  });

  it("pm2: durmuş süreç yüksek; yeniden başlama ve hata eşiği orta", () => {
    const u = uyarilariUret({}, null, null, {
      surecler: [
        { ad: "siparis-backend", durum: "errored", sonSaatYenidenBaslama: 0, hata15: 0 },
        { ad: "mutabiko-api", durum: "online", sonSaatYenidenBaslama: 4, hata15: 12 },
        { ad: "mutabiko-web", durum: "online", sonSaatYenidenBaslama: 0, hata15: 9 },
      ],
    });
    expect(u.map((x) => [x.seviye, x.metin])).toEqual([
      ["yuksek", "siparis-backend çalışmıyor (errored)"],
      ["orta", "mutabiko-api son 1 saatte 4 kez yeniden başladı"],
      ["orta", "mutabiko-api: son 15 dk'da 12 hata satırı"],
    ]);
  });
});

describe("pm2", () => {
  it("jlist çıktısını sadeleştirir", () => {
    const [s] = jlistCevir(
      [{ name: "siparis-backend", pm_id: 0, monit: { memory: 157286400, cpu: 3 }, pm2_env: { status: "online", pm_uptime: 1000, restart_time: 2, pm_out_log_path: "o.log", pm_err_log_path: "e.log" } }],
      61_000,
    );
    expect(s).toEqual({ ad: "siparis-backend", id: 0, durum: "online", calismaSn: 60, yenidenBaslama: 2, bellekMb: 150, cpu: 3, outLog: "o.log", errLog: "e.log" });
  });

  it("son 1 saatteki yeniden başlama farkını sayar", () => {
    const say = yenidenBaslamaIzleyici();
    expect(say("a", 5, 0)).toBe(0);
    expect(say("a", 7, 10 * 60_000)).toBe(2);
    expect(say("a", 7, 61 * 60_000)).toBe(0);
  });

  it("log dosyasını kuyruktan okur: ilk taramada geçmiş, sonra yalnız yeni tam satırlar yayınlanır", async () => {
    const dizin = await mkdtemp(join(tmpdir(), "atlas-log-"));
    const out = join(dizin, "out.log");
    const err = join(dizin, "err.log");
    await writeFile(out, "eski 1\neski 2\n");
    await writeFile(err, "");
    const yayinlanan = [];
    const iz = logIzleyici({ yayinla: (v) => yayinlanan.push(v) });
    const surec = [{ ad: "s", outLog: out, errLog: err }];

    await iz.tara(surec);
    expect(iz.satirlar("s").map((x) => x.metin)).toEqual(["eski 1", "eski 2"]);
    expect(yayinlanan).toHaveLength(0);

    await appendFile(out, "yeni satır\nyarım");
    await appendFile(err, "TypeError: patladı\n");
    await iz.tara(surec);
    expect(yayinlanan).toHaveLength(1);
    expect(yayinlanan[0].satirlar.map((x) => [x.akim, x.hata, x.metin])).toEqual([
      ["out", false, "yeni satır"],
      ["err", true, "TypeError: patladı"],
    ]);
    expect(iz.hataSayisi("s")).toBe(1);

    await appendFile(out, " satır tamamlandı\n");
    await iz.tara(surec);
    expect(iz.satirlar("s").at(-1).metin).toBe("yarım satır tamamlandı");

    // pm2-logrotate dosyayı kısaltırsa baştan okunur.
    await writeFile(out, "döndü\n");
    await iz.tara(surec);
    expect(iz.satirlar("s").at(-1).metin).toBe("döndü");
  });
});

describe("github", () => {
  it("commit kaydını ortak şekle çevirir (mesajın yalnız ilk satırı)", () => {
    expect(githubCommitCevir({ sha: "abcdef1234567", commit: { committer: { date: "2026-10-13T10:00:00Z" }, message: "feat: x\n\ngövde" } }))
      .toEqual({ hash: "abcdef1234567", kisa: "abcdef1", tarih: "2026-10-13T10:00:00Z", mesaj: "feat: x" });
  });
});
