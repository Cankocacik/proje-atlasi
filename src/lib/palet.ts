// Komut paleti araması (saf; test/palet.test.ts).

/** Türkçe harfleri ve aksanları katlar: "gunlugu" yazan "Günlüğü"nü, "isik" yazan "Işık"ı bulur. */
export function katla(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Harfler sırayla geçiyor mu ("rsbl" → "rosbel"). */
function siraliGecer(metin: string, q: string): boolean {
  let i = 0;
  for (const c of metin) if (c === q[i]) i++;
  return i === q.length;
}

export function puan(ad: string, ek: string, sorgu: string): number {
  const q = katla(sorgu.trim());
  if (!q) return 1;
  const a = katla(ad);
  if (a === q) return 120;
  if (a.startsWith(q)) return 100;
  if (a.split(/[\s/·&-]+/).some((k) => k.startsWith(q))) return 80;
  if (a.includes(q)) return 60;
  if (katla(ek).includes(q)) return 40;
  if (q.length >= 2 && siraliGecer(a.replace(/\s+/g, ""), q.replace(/\s+/g, ""))) return 15;
  return 0;
}

/** Eşleşenler puana göre (eşitlikte verilen sıra korunur). Boş sorgu ilk `sinir` öğeyi verir. */
export function paletAra<T extends { ad: string; anahtar?: string }>(ogeler: T[], sorgu: string, sinir = 14): T[] {
  return ogeler
    .map((o, i) => ({ o, i, p: puan(o.ad, o.anahtar ?? "", sorgu) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, sinir)
    .map((x) => x.o);
}
