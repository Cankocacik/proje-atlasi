// Telegram kurulum yardımcısı: `npm run telegram`
//  1. @BotFather → /newbot → token'ı .env ATLAS_TELEGRAM_TOKEN= satırına yaz
//  2. Telegram'da bota bir mesaj at (ya da botu gruba ekleyip grupta yaz)
//  3. Bu komut: bota yazmış sohbetlerin kimliklerini listeler → .env ATLAS_TELEGRAM_SOHBET=
//  4. pm2 restart proje-atlasi → ekranda Olay günlüğü → "Telegram'a deneme"
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { telegramSohbetleri } from "../server/telegram.js";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(KOK, ".env"))) process.loadEnvFile(join(KOK, ".env"));

const token = process.env.ATLAS_TELEGRAM_TOKEN?.trim();
if (!token) {
  console.error("Önce .env'e ATLAS_TELEGRAM_TOKEN= yaz (@BotFather → /newbot).");
  process.exit(1);
}
try {
  const sohbetler = await telegramSohbetleri(token);
  if (!sohbetler.length) {
    console.log("Bota henüz kimse yazmamış. Telegram'da bota bir mesaj at, sonra bu komutu tekrar çalıştır.");
  } else {
    console.log("Bota yazan sohbetler — kendininkini .env ATLAS_TELEGRAM_SOHBET= satırına yaz:\n");
    for (const s of sohbetler) console.log(`  ${String(s.id).padEnd(16)} ${s.ad ?? ""} (${s.tur})`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
