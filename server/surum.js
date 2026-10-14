// Atlas'ın kendi sürümü: hangi commit'ten çalıştığını ve ne zamandır açık olduğunu bilir.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function git(kok, args) {
  return new Promise((ok) => {
    execFile("git", ["-C", kok, ...args], { timeout: 10000, windowsHide: true }, (e, out) => ok(e ? null : out.trim()));
  });
}

/** Çalışan kodun commit'i + derlenmiş arayüzün hangi commit'ten üretildiği. */
export async function atlasSurumu(kok) {
  const [satir, derleme] = await Promise.all([
    git(kok, ["log", "-1", "--format=%h%x1f%cI%x1f%s"]),
    readFile(join(kok, "dist", ".atlas-surum"), "utf8").then((s) => s.trim()).catch(() => null),
  ]);
  const [commit, tarih, mesaj] = satir ? satir.split("\x1f") : [null, null, null];
  return {
    commit,
    tarih,
    mesaj,
    derleme,
    // Derleme işareti yoksa (elle `npm run build`) karar verilemez; yalnız açıkça farklıysa eski sayılır.
    derlemeEski: Boolean(commit && derleme && !commit.startsWith(derleme) && !derleme.startsWith(commit)),
    node: process.version,
    baslangic: new Date().toISOString(),
  };
}
