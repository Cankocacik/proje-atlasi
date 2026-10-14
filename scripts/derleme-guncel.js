// Arayüz kodun şu anki commit'inden mi derlenmiş? Değilse çıkış kodu 1 (baslat.cmd yeniden derler).
// `git pull` sonrası eski arayüzle açılmasın diye.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

try {
  const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const derleme = readFileSync("dist/.atlas-surum", "utf8").trim();
  process.exit(head.startsWith(derleme) || derleme.startsWith(head) ? 0 : 1);
} catch {
  process.exit(1);
}
