// Parola özeti + oturum sırrı üretir: `npm run parola`
// Çıktıdaki iki satır sunucudaki .env dosyasına yazılır. Parolanın kendisi hiçbir yere kaydedilmez.
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { parolaOzeti } from "../server/kimlik.js";

function gizliSor(soru) {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(soru);
    // Yazılan karakterler ekrana basılmasın.
    rl._writeToOutput = () => {};
    rl.question("", (cevap) => {
      rl.close();
      process.stdout.write("\n");
      ok(cevap);
    });
  });
}

const p1 = await gizliSor("Yeni parola (en az 12 karakter): ");
if (p1.length < 12) {
  console.error("Parola en az 12 karakter olmalı.");
  process.exit(1);
}
const p2 = await gizliSor("Tekrar: ");
if (p1 !== p2) {
  console.error("Parolalar eşleşmiyor.");
  process.exit(1);
}

console.log("\n.env dosyasına şu iki satırı yaz (eskisi varsa değiştir):\n");
console.log(`ATLAS_PAROLA_HASH=${await parolaOzeti(p1)}`);
console.log(`ATLAS_OTURUM_SIRRI=${randomBytes(32).toString("base64url")}`);
console.log("\nOturum sırrını değiştirmek açık tüm oturumları kapatır.");
