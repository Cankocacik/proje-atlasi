import { useEffect, useRef, useState } from "react";

const sorgu = "(prefers-reduced-motion: reduce)";

/** Kullanıcı hareket azaltmayı seçtiyse true (canlı değişir). Parçacık/sayaç/tur bunu izler. */
export function useHareketAzalt(): boolean {
  const [azalt, setAzalt] = useState(() => typeof window !== "undefined" && window.matchMedia?.(sorgu).matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.(sorgu);
    if (!mq) return;
    const degisti = () => setAzalt(mq.matches);
    mq.addEventListener("change", degisti);
    return () => mq.removeEventListener("change", degisti);
  }, []);
  return azalt;
}

/**
 * Sayı değişince eski değerden yenisine yumuşak sayar (ilk açılışta 0'dan).
 * Hareket azaltma açıksa doğrudan yeni değeri gösterir.
 */
export function useSayac(hedef: number, sure = 900): number {
  const azalt = useHareketAzalt();
  const [deger, setDeger] = useState(azalt ? hedef : 0);
  const gorunen = useRef(deger);
  gorunen.current = deger;
  useEffect(() => {
    const bas = gorunen.current;
    if (azalt || bas === hedef) {
      setDeger(hedef);
      return;
    }
    let kare = 0;
    const t0 = performance.now();
    const adim = (t: number) => {
      const k = Math.min(1, (t - t0) / sure);
      const e = 1 - Math.pow(1 - k, 3);
      setDeger(Math.round(bas + (hedef - bas) * e));
      if (k < 1) kare = requestAnimationFrame(adim);
    };
    kare = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(kare);
  }, [hedef, sure, azalt]);
  return deger;
}

export interface Kisayollar {
  palet: () => void;
  tara: () => void;
  duvar: () => void;
  gorunum: () => void;
  kacis: () => void;
}

const yaziAlani = (h: EventTarget | null) => {
  const el = h as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
};

/**
 * Klavye: Ctrl/⌘+K ya da / → komut paleti · R → şimdi tara · D → duvar modu · L → harita/liste · Esc.
 * Yazı alanındayken tek harfli kısayollar çalışmaz (aramaya "r" yazmak taramayı başlatmasın).
 */
export function useKisayollar(k: Kisayollar) {
  const ref = useRef(k);
  ref.current = k;
  useEffect(() => {
    const bas = (e: KeyboardEvent) => {
      const f = ref.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        f.palet();
        return;
      }
      if (e.key === "Escape") {
        f.kacis();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || yaziAlani(e.target)) return;
      const tus = e.key.toLocaleLowerCase("tr-TR");
      if (tus === "/" || tus === "?") {
        e.preventDefault();
        f.palet();
      } else if (tus === "r") f.tara();
      else if (tus === "d") f.duvar();
      else if (tus === "l") f.gorunum();
    };
    window.addEventListener("keydown", bas);
    return () => window.removeEventListener("keydown", bas);
  }, []);
}
