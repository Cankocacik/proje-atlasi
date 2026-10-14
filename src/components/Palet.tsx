import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { paletAra } from "../lib/palet";
import { Svg } from "./Ikon";

export interface PaletOgesi {
  id: string;
  tur: "Proje" | "Bölüm" | "Eylem" | "Bağlantı";
  ad: string;
  alt?: string;
  /** Aramada ada ek olarak bakılan metin (tür, açıklama…). */
  anahtar?: string;
  kisayol?: string;
  st?: string;
  ikon: ReactNode;
  calistir: () => void;
}

/** Ctrl/⌘+K komut paleti: proje bul, bölüme git, eylem çalıştır. Klavyeyle baştan sona kullanılır. */
export function Palet({ ogeler, kapat }: { ogeler: PaletOgesi[]; kapat: () => void }) {
  const [sorgu, setSorgu] = useState("");
  const [aktif, setAktif] = useState(0);
  const girdi = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const onceki = useRef<Element | null>(null);
  const kimlik = useId();
  const sonuclar = paletAra(ogeler, sorgu, 14);
  const secim = Math.min(aktif, Math.max(0, sonuclar.length - 1));

  useEffect(() => {
    onceki.current = document.activeElement;
    girdi.current?.focus();
    // Kapanınca odak paleti açan öğeye döner.
    return () => (onceki.current as HTMLElement | null)?.focus?.();
  }, []);

  useEffect(() => {
    liste.current?.querySelector<HTMLElement>(`[data-sira="${secim}"]`)?.scrollIntoView({ block: "nearest" });
  }, [secim]);

  const calistir = (o: PaletOgesi | undefined) => {
    if (!o) return;
    kapat();
    // Palet kapanıp odak geri döndükten sonra çalışsın (bölüme kaydırma odağı ezmesin).
    requestAnimationFrame(() => o.calistir());
  };

  const tus = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setAktif((secim + 1) % Math.max(1, sonuclar.length));
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setAktif((secim - 1 + sonuclar.length) % Math.max(1, sonuclar.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      calistir(sonuclar[secim]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      kapat();
    }
  };

  return (
    <div className="palet-zemin" onPointerDown={(e) => e.target === e.currentTarget && kapat()}>
      <div className="palet" role="dialog" aria-modal="true" aria-label="Komut paleti">
        <div className="palet-girdi">
          <Svg ad="ara" boyut={18} />
          <input
            ref={girdi}
            value={sorgu}
            onChange={(e) => {
              setSorgu(e.target.value);
              setAktif(0);
            }}
            onKeyDown={tus}
            placeholder="Proje, bölüm ya da komut ara…"
            aria-label="Komut ara"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${kimlik}-liste`}
            aria-activedescendant={sonuclar.length ? `${kimlik}-${secim}` : undefined}
            aria-autocomplete="list"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>
        <ul ref={liste} id={`${kimlik}-liste`} className="palet-liste" role="listbox" aria-label="Sonuçlar">
          {sonuclar.map((o, i) => (
            <li
              key={o.id}
              id={`${kimlik}-${i}`}
              data-sira={i}
              role="option"
              aria-selected={i === secim}
              className={`palet-oge${i === secim ? " on" : ""}${o.st ? ` st-${o.st}` : ""}`}
              onPointerMove={() => i !== secim && setAktif(i)}
              onClick={() => calistir(o)}
            >
              <span className="palet-ikon">{o.ikon}</span>
              <span className="palet-metin">
                <span className="palet-ad">{o.ad}</span>
                {o.alt && <span className="palet-alt">{o.alt}</span>}
              </span>
              {o.kisayol && <kbd>{o.kisayol}</kbd>}
              <span className="palet-tur mono">{o.tur}</span>
            </li>
          ))}
          {!sonuclar.length && <li className="palet-bos">“{sorgu}” için sonuç yok.</li>}
        </ul>
        <div className="palet-alt-serit mono">
          <span><kbd>↑</kbd><kbd>↓</kbd> gez</span>
          <span><kbd>↵</kbd> aç</span>
          <span><kbd>R</kbd> tara</span>
          <span><kbd>D</kbd> duvar modu</span>
          <span><kbd>L</kbd> harita/liste</span>
          <span><kbd>←→↑↓</kbd> haritada gez</span>
        </div>
      </div>
    </div>
  );
}
