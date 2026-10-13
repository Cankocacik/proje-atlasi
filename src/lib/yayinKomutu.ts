import type { YayinAdimi } from "../types";

/**
 * Komutları PowerShell 5.1'de "öncekisi başarılıysa" zincirine çevirir (5.1'de `&&` yok).
 * Alt alta yapıştırılan satırlar öncekinin hatasına bakmadan çalışır: git pull çakışsa bile
 * pm2 restart yeni kodu canlıya alırdı. `$?` yerel komutun çıkış koduna da bakar.
 */
export function zincir(komutlar: string[]): string {
  return komutlar.reduceRight((ic, k) => (ic ? `${k}; if ($?) { ${ic} }` : k), "");
}

/**
 * "Tümünü kopyala" parçaları: karar noktası (`dur`) olan adım kendi parçasını kapatır,
 * sonrakiler ayrı parça olur — çıktısı okunmadan (ör. migrate:verify) devam edilmesin.
 * Bilgi satırları komut değildir, parçaya girmez.
 */
export function kopyaParcalari(adimlar: YayinAdimi[]): string[][] {
  const parcalar: string[][] = [];
  let parca: string[] = [];
  for (const a of adimlar) {
    if (a.bilgi) continue;
    parca.push(a.adim);
    if (a.dur) {
      parcalar.push(parca);
      parca = [];
    }
  }
  if (parca.length) parcalar.push(parca);
  return parcalar;
}
