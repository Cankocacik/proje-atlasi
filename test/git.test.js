// Gerçek git ile: geçici bir "uzak" repo + iki kopya. Sunucu kopyası geride kalınca
// gitOzeti bekleyen commitleri ve dosyaları doğru bulmalı.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitOzeti } from "../server/git.js";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const kimlik = ["-c", "user.name=Atlas Test", "-c", "user.email=atlas@test.invalid", "-c", "commit.gpgsign=false"];

function kur() {
  const kok = mkdtempSync(join(tmpdir(), "atlas-git-"));
  const uzak = join(kok, "uzak.git");
  git(kok, "init", "--bare", "-q", "-b", "main", uzak);
  const gelistirme = join(kok, "gelistirme");
  git(kok, "clone", "-q", uzak, gelistirme);
  mkdirSync(join(gelistirme, "backend", "migrations"), { recursive: true });
  writeFileSync(join(gelistirme, "backend", "index.js"), "v1\n");
  git(gelistirme, "add", ".");
  git(gelistirme, ...kimlik, "commit", "-q", "-m", "ilk");
  git(gelistirme, "push", "-q", "origin", "HEAD:main");
  const sunucu = join(kok, "sunucu");
  git(kok, "clone", "-q", uzak, sunucu);
  return { gelistirme, sunucu };
}

describe("gitOzeti (gerçek git)", () => {
  it("sunucu kopyası geride kalınca bekleyen commit ve dosyaları verir; akış upstream'den okunur", async () => {
    const { gelistirme, sunucu } = kur();
    writeFileSync(join(gelistirme, "backend", "migrations", "0002-x.sql"), "select 1;\n");
    writeFileSync(join(gelistirme, "backend", "index.js"), "v2\n");
    git(gelistirme, "add", ".");
    git(gelistirme, ...kimlik, "commit", "-q", "-m", "migration ekle");
    git(gelistirme, "push", "-q", "origin", "HEAD:main");
    git(sunucu, "fetch", "-q");

    const o = await gitOzeti(sunucu, { ortam: "sunucu" });
    expect(o).toMatchObject({ var: true, dal: "main", geride: 1, ileride: 0, degisen: 0 });
    expect(o.son.mesaj).toBe("migration ekle"); // sunucuda akış origin'deki son işi gösterir
    expect(o.canlida).toBe(git(sunucu, "rev-parse", "--short", "HEAD")); // canlıdaki hâlâ ilk commit
    expect(o.bekleyen.commitler.map((c) => c.mesaj)).toEqual(["migration ekle"]);
    expect(o.bekleyen.dosyalar.sort()).toEqual(["backend/index.js", "backend/migrations/0002-x.sql"]);

    // Yerel kipte akış HEAD'den okunur.
    expect((await gitOzeti(sunucu, { ortam: "yerel" })).son.mesaj).toBe("ilk");
  }, 30000);

  it("kopyada yerel commit de varsa yalnız uzaktan gelen dosyalar bekleyen sayılır", async () => {
    const { gelistirme, sunucu } = kur();
    writeFileSync(join(gelistirme, "backend", "index.js"), "v2\n");
    git(gelistirme, "add", ".");
    git(gelistirme, ...kimlik, "commit", "-q", "-m", "uzak iş");
    git(gelistirme, "push", "-q", "origin", "HEAD:main");
    // Sunucuda elle yapılmış, push edilmemiş bir migration: yayın adımına dönüşmemeli.
    mkdirSync(join(sunucu, "backend", "migrations"), { recursive: true });
    writeFileSync(join(sunucu, "backend", "migrations", "elle.sql"), "select 2;\n");
    git(sunucu, "add", ".");
    git(sunucu, ...kimlik, "commit", "-q", "-m", "sunucuda elle");
    git(sunucu, "fetch", "-q");

    const o = await gitOzeti(sunucu, { ortam: "sunucu" });
    expect(o).toMatchObject({ geride: 1, ileride: 1 });
    expect(o.bekleyen.toplam).toBe(1);
    expect(o.bekleyen.dosyalar).toEqual(["backend/index.js"]);
  }, 30000);

  it("güncel kopyada bekleyen yok; commit edilmemiş ve push edilmemiş iş sayılır", async () => {
    const { gelistirme } = kur();
    writeFileSync(join(gelistirme, "kirli.txt"), "x\n");
    git(gelistirme, ...kimlik, "commit", "-q", "--allow-empty", "-m", "yerel");
    const o = await gitOzeti(gelistirme);
    expect(o).toMatchObject({ geride: 0, ileride: 1, degisen: 1, bekleyen: null });
  }, 30000);

  it("repo değilse var: false", async () => {
    expect(await gitOzeti(mkdtempSync(join(tmpdir(), "atlas-bos-")))).toEqual({ var: false, kaynak: "git" });
  });
});
