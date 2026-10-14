import { useEffect, useRef, useState } from "react";
import type { Olay, Proje } from "../types";
import { yeniOlaylar } from "../lib/olay";
import { Svg } from "./Ikon";

const OMUR = { hata: 16000, uyari: 10000, iyi: 8000, bilgi: 7000 } as const;
const IKON = { hata: "uyari", uyari: "uyari", iyi: "kalkan", bilgi: "nabiz" } as const;

function Tost({ o, proje, kapat, sec }: { o: Olay; proje?: Proje; kapat: () => void; sec: (id: string) => void }) {
  const omur = OMUR[o.seviye] ?? 8000;
  const [duraklat, setDuraklat] = useState(false);
  const kalan = useRef(omur);
  useEffect(() => {
    if (duraklat) return;
    const bas = Date.now();
    const t = setTimeout(kapat, kalan.current);
    return () => {
      clearTimeout(t);
      kalan.current -= Date.now() - bas;
    };
  }, [duraklat, kapat]);
  return (
    <li
      className={`tost tost-${o.seviye}${duraklat ? " durdu" : ""}`}
      style={{ ["--omur" as string]: `${omur}ms` }}
      onPointerEnter={() => setDuraklat(true)}
      onPointerLeave={() => setDuraklat(false)}
    >
      <span className="tost-ikon"><Svg ad={IKON[o.seviye] ?? "nabiz"} boyut={17} /></span>
      <span className="tost-govde">
        <span className="tost-metin">{o.metin}</span>
        <span className="tost-alt mono">
          {new Date(o.zaman).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          {proje && (
            <button type="button" className="metin-dugme" onClick={() => { sec(proje.id); kapat(); }}>
              {proje.ad} <Svg ad="ok" boyut={12} />
            </button>
          )}
        </span>
      </span>
      <button type="button" className="tost-kapat" aria-label="Bildirimi kapat" onClick={kapat}><Svg ad="kapat" boyut={14} /></button>
      <span className="tost-omur" aria-hidden="true" />
    </li>
  );
}

/**
 * Sayfa açıkken gelen yeni olaylar sağ altta kısa süre görünür (Atlas açılış satırı hariç).
 * İlk yüklemedeki geçmiş olaylar gösterilmez — yalnız sayfa açıkken olanlar.
 */
export function Tostlar({ olaylar, projeler, sec }: { olaylar: Olay[] | undefined; projeler: Proje[]; sec: (id: string) => void }) {
  const [liste, setListe] = useState<Olay[]>([]);
  const son = useRef<number | null>(null);
  const kapaticilar = useRef(new Map<number, () => void>());

  useEffect(() => {
    if (!olaylar) return;
    const { yeniler, enBuyuk } = yeniOlaylar(olaylar, son.current);
    son.current = enBuyuk;
    const gelen = yeniler.filter((o) => o.tur !== "atlas");
    if (gelen.length) setListe((l) => [...gelen.reverse(), ...l].slice(0, 4));
  }, [olaylar]);

  const kapatici = (id: number) => {
    let f = kapaticilar.current.get(id);
    if (!f) {
      f = () => {
        setListe((l) => l.filter((x) => x.id !== id));
        kapaticilar.current.delete(id);
      };
      kapaticilar.current.set(id, f);
    }
    return f;
  };

  const byId = new Map(projeler.map((p) => [p.id, p]));
  return (
    <ol className="tostlar" aria-live="polite" aria-label="Yeni olaylar">
      {liste.map((o) => (
        <Tost key={o.id} o={o} proje={o.projeId ? byId.get(o.projeId) : undefined} kapat={kapatici(o.id)} sec={sec} />
      ))}
    </ol>
  );
}
