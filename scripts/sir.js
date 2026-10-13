// Oturum çerezini imzalayan sırrı üretir: `npm run sir` → çıktıyı .env'e yaz.
// Değiştirmek açık tüm Atlas oturumlarını kapatır.
import { randomBytes } from "node:crypto";

console.log(`ATLAS_OTURUM_SIRRI=${randomBytes(32).toString("base64url")}`);
