// Haritada ok tuşlarıyla gezinme: seçili düğümden o yöndeki en yakın düğüm (saf; test/komsu.test.ts).

export type Yon = "sol" | "sag" | "yukari" | "asagi";

export interface Nokta {
  id: string;
  x: number;
  y: number;
}

/**
 * Önce yönün 45°'lik konisindeki (ana uzaklık ≥ yan sapma) düğümler, yoksa yarı düzlemin tamamı;
 * aralarından "ana uzaklık + 2 × yan sapma"sı en küçüğü. Aşağı basınca biraz aşağıdaki ama çok
 * sağdaki düğüme değil, gerçekten aşağıdakine gidilir.
 */
export function yondekiKomsu(noktalar: Nokta[], id: string, yon: Yon): string | null {
  const o = noktalar.find((n) => n.id === id);
  if (!o) return null;
  const adaylar = noktalar
    .filter((n) => n.id !== id)
    .map((n) => {
      const dx = n.x - o.x;
      const dy = n.y - o.y;
      const ana = yon === "sag" ? dx : yon === "sol" ? -dx : yon === "asagi" ? dy : -dy;
      const yan = yon === "sag" || yon === "sol" ? Math.abs(dy) : Math.abs(dx);
      return { id: n.id, ana, yan, skor: ana + 2 * yan };
    })
    .filter((a) => a.ana > 0);
  const konide = adaylar.filter((a) => a.ana >= a.yan);
  const havuz = konide.length ? konide : adaylar;
  return havuz.reduce<(typeof havuz)[number] | null>((en, a) => (!en || a.skor < en.skor ? a : en), null)?.id ?? null;
}

export const OK_YONU: Record<string, Yon> = { ArrowLeft: "sol", ArrowRight: "sag", ArrowUp: "yukari", ArrowDown: "asagi" };
