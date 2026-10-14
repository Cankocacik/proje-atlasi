// Yanıt süresi eğrisi (saf; test/havali.test.ts). Veri olmayan kutu çizgiyi böler — boşluk uydurulmaz.

export interface Egri {
  /** Çizgi: her kesintisiz parça ayrı "M…L…" alt yolu. */
  cizgi: string;
  /** Çizginin altını dolduran alan (parça parça kapanır). */
  alan: string;
  enCok: number | null;
  enAz: number | null;
  /** Son değerin noktası (canlı uç). */
  son: { x: number; y: number } | null;
}

export function egriYolu(sureler: (number | null)[], g: number, y: number, pay = 3): Egri {
  const degerler = sureler.filter((s): s is number => typeof s === "number");
  if (!degerler.length) return { cizgi: "", alan: "", enCok: null, enAz: null, son: null };
  const enCok = Math.max(...degerler);
  const enAz = Math.min(...degerler);
  // Taban 0 değil en küçük değerin biraz altı: 800 ↔ 900 ms oynaması düz çizgi gibi görünmesin.
  const alt = Math.max(0, enAz - (enCok - enAz) * 0.25);
  const aralik = Math.max(1, enCok - alt);
  const adim = sureler.length > 1 ? g / (sureler.length - 1) : 0;
  const nokta = (i: number, v: number) => ({
    x: Math.round(i * adim * 10) / 10,
    y: Math.round((y - pay - ((v - alt) / aralik) * (y - 2 * pay)) * 10) / 10,
  });

  const parcalar: { x: number; y: number }[][] = [];
  let parca: { x: number; y: number }[] = [];
  sureler.forEach((v, i) => {
    if (typeof v === "number") parca.push(nokta(i, v));
    else if (parca.length) {
      parcalar.push(parca);
      parca = [];
    }
  });
  if (parca.length) parcalar.push(parca);

  // Tek örnekli parça (iki boş kutu arası) çizgisiz kalırdı: kısa yatay çentik olarak çizilir.
  const cizgi = parcalar
    .map((p) => (p.length === 1 ? `M${p[0].x - 2} ${p[0].y}L${p[0].x + 2} ${p[0].y}` : p.map((n, j) => `${j ? "L" : "M"}${n.x} ${n.y}`).join("")))
    .join("");
  const alan = parcalar
    .map((p) => `M${p[0].x} ${y}${p.map((n) => `L${n.x} ${n.y}`).join("")}L${p[p.length - 1].x} ${y}Z`)
    .join("");
  const sonParca = parcalar[parcalar.length - 1];
  const sonIndeks = sureler.length - 1;
  const son = typeof sureler[sonIndeks] === "number" ? sonParca[sonParca.length - 1] : null;
  return { cizgi, alan, enCok, enAz, son };
}
