import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Anlik, Proje } from "../types";
import { dirsekYol, kutuBul, merkez } from "../lib/geometri";
import { durumEtiketi } from "../lib/etiket";
import { goreli } from "../lib/zaman";
import { ASAMA_ETIKET } from "../lib/etiket";
import { projeIlerlemesi } from "../lib/ilerleme";
import { ProjeIkon } from "./Ikon";

interface Props {
  veri: Anlik;
  secili: string;
  sec: (id: string) => void;
  eslesir: (p: Proje) => boolean;
  olcek: number;
  radar: boolean;
  simdi: Date;
}

export function Harita({ veri, secili, sec, eslesir, olcek, radar, simdi }: Props) {
  const { genislik: G, yukseklik: Y } = veri.harita;
  const zemin = useRef<HTMLDivElement>(null);
  const [genislik, setGenislik] = useState(G);
  useEffect(() => {
    if (!zemin.current) return;
    const gozlemci = new ResizeObserver(([giris]) => setGenislik(giris.contentRect.width));
    gozlemci.observe(zemin.current);
    return () => gozlemci.disconnect();
  }, []);
  // Küçük ekranlarda okunabilirlik için harita kendi içinde kaydırılır.
  const gercekOlcek = Math.max(0.72, Math.min(1, (genislik - 24) / G)) * olcek;
  const byId = new Map(veri.projeler.map((p) => [p.id, p]));
  const hub = veri.projeler.find((p) => p.ikon === "hub" && p.kart);
  const hubMerkez = hub ? merkez(kutuBul(hub)) : { x: G / 2, y: Y / 2 };

  const altBaglar = veri.projeler
    .filter((p) => p.ust && byId.get(p.ust))
    .map((p) => ({ id: p.id, yol: dirsekYol(kutuBul(byId.get(p.ust!)!), kutuBul(p)), etkin: eslesir(p) || eslesir(byId.get(p.ust!)!) }));

  const akislar = veri.akislar
    .filter((a) => byId.has(a.kaynak) && byId.has(a.hedef))
    .map((a) => ({ ...a, etkin: eslesir(byId.get(a.kaynak)!) || eslesir(byId.get(a.hedef)!), yol: dirsekYol(kutuBul(byId.get(a.kaynak)!), kutuBul(byId.get(a.hedef)!)) }));

  return (
    <div className="harita-zemin" ref={zemin}>
      <div style={{ width: Math.round(G * gercekOlcek), height: Math.round(Y * gercekOlcek), margin: "12px auto", position: "relative" }}>
        <div className="harita-tuval" style={{ width: G, height: Y, transform: `scale(${gercekOlcek})` }}>
          {radar && (
            <div className="tarama" style={{ left: hubMerkez.x, top: hubMerkez.y, width: G * 1.05, height: G * 1.05 }} />
          )}
          <svg width={G} height={Y} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} aria-hidden="true">
            <defs>
              <marker id="ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--acc)" />
              </marker>
            </defs>
            <g stroke="rgba(174,183,198,.36)" strokeWidth="1.2" fill="none">
              {altBaglar.map((b) => (
                <path key={b.id} d={b.yol.d} opacity={b.etkin ? 1 : 0.12} />
              ))}
            </g>
            <g stroke="var(--acc)" strokeWidth="1.3" fill="none">
              {akislar.map((a) => (
                <path key={`${a.kaynak}-${a.hedef}`} className="akan" d={a.yol.d} markerEnd="url(#ok)" opacity={a.etkin ? 0.75 : 0.12} />
              ))}
            </g>
          </svg>
          {akislar
            .filter((a) => a.etiket)
            .map((a) => (
              <span key={`e-${a.kaynak}-${a.hedef}`} className="cizgi-etiket" style={{ left: a.yol.etiket.x, top: a.yol.etiket.y, opacity: a.etkin ? 1 : 0.15 }}>
                {a.etiket}
              </span>
            ))}

          {veri.projeler
            .filter((p) => !p.kart)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                className={`dn st-${p.durum}${p.uyarilar.length ? " uyari" : ""}${p.id === secili ? " sec" : ""}`}
                style={{ left: p.konum.x, top: p.konum.y, opacity: eslesir(p) ? 1 : 0.15 }}
                aria-pressed={p.id === secili}
                aria-label={`${p.ad}, ${durumEtiketi(p)}${p.uyarilar.length ? `, ${p.uyarilar.length} uyarı` : ""}`}
                onClick={() => sec(p.id)}
              >
                <span className="cekirdek" />
                <span className="etiket">{p.ad}</span>
              </button>
            ))}

          {veri.projeler
            .filter((p) => p.kart)
            .map((p) => {
              const k = kutuBul(p);
              const progression = projeIlerlemesi(veri, p.id);
              const stil: CSSProperties = { left: k.x, top: k.y, width: k.w, height: k.h, opacity: eslesir(p) ? 1 : 0.15 };
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`kart st-${p.durum}${p.ikon === "hub" ? " hub" : ""}${p.id === secili ? " sec" : ""}`}
                  style={stil}
                  aria-pressed={p.id === secili}
                  aria-label={`${p.ad}, ${durumEtiketi(p)}${p.uyarilar.length ? `, ${p.uyarilar.length} uyarı` : ""}`}
                  onClick={() => sec(p.id)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <span className="ico"><ProjeIkon tur={p.ikon} /></span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, alignItems: "flex-start" }}>
                      <span className="kart-ad">{p.ad}</span>
                      <span className="pill"><span className="dot" style={{ width: 6, height: 6 }} />{durumEtiketi(p)}</span>
                    </span>
                  </span>
                  <span className="kart-ilerleme">
                    <span className="kart-ilerleme-metin"><span>{progression.toplam ? `${progression.tamam} / ${progression.toplam} adım` : ASAMA_ETIKET[p.asama]}</span><span>{progression.yuzde !== null ? `${progression.yuzde}%` : ""}</span></span>
                    {progression.yuzde !== null ? <span className="ilerleme-cubuk"><span style={{ width: `${progression.yuzde}%` }} /></span> : <span className="asamalar">{[1, 2, 3, 4].map((i) => <span key={i} className={`asama${p.asamaSira >= i ? " on" : ""}`} />)}</span>}
                  </span>
                  <span className="kart-alt">
                    <span>{p.surum ?? p.git?.son?.kisa ?? "—"}</span>
                    <span>{p.git?.son ? goreli(p.git.son.tarih, simdi) : "git yok"}</span>
                  </span>
                  {p.uyarilar.length > 0 && <span className="ping" />}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
