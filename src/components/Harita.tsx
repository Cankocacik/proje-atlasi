import type { CSSProperties } from "react";
import type { Anlik, Proje } from "../types";
import { dirsekYol, kutuBul, merkez } from "../lib/geometri";
import { durumEtiketi } from "../lib/etiket";
import { goreli } from "../lib/zaman";
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
  const byId = new Map(veri.projeler.map((p) => [p.id, p]));
  const hub = veri.projeler.find((p) => p.ikon === "hub" && p.kart);
  const hubMerkez = hub ? merkez(kutuBul(hub)) : { x: G / 2, y: Y / 2 };

  const altBaglar = veri.projeler
    .filter((p) => p.ust && byId.get(p.ust))
    .map((p) => ({ id: p.id, a: merkez(kutuBul(byId.get(p.ust!)!)), b: merkez(kutuBul(p)) }));

  const akislar = veri.akislar
    .filter((a) => byId.has(a.kaynak) && byId.has(a.hedef))
    .map((a) => ({ ...a, yol: dirsekYol(kutuBul(byId.get(a.kaynak)!), kutuBul(byId.get(a.hedef)!)) }));

  return (
    <div className="harita-zemin">
      <div style={{ width: Math.round(G * olcek), height: Math.round(Y * olcek), margin: "0 auto", position: "relative" }}>
        <div className="harita-tuval" style={{ width: G, height: Y, transform: `scale(${olcek})` }}>
          {radar && (
            <div className="tarama" style={{ left: hubMerkez.x, top: hubMerkez.y, width: G * 1.05, height: G * 1.05 }} />
          )}
          <svg width={G} height={Y} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} aria-hidden="true">
            <defs>
              <marker id="ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--live)" />
              </marker>
            </defs>
            <ellipse cx={hubMerkez.x} cy={hubMerkez.y} rx={G * 0.21} ry={Y * 0.25} fill="none" stroke="rgba(138,149,168,.18)" strokeDasharray="3 5" />
            <ellipse cx={hubMerkez.x} cy={hubMerkez.y} rx={G * 0.35} ry={Y * 0.4} fill="none" stroke="rgba(138,149,168,.12)" strokeDasharray="1 6" />
            <g stroke="rgba(174,183,198,.42)" strokeWidth="1.2">
              {altBaglar.map((b) => (
                <line key={b.id} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y} />
              ))}
            </g>
            <g stroke="var(--live)" strokeWidth="1.5" fill="none">
              {akislar.map((a) => (
                <path key={`${a.kaynak}-${a.hedef}`} className="akan" d={a.yol.d} markerEnd="url(#ok)" />
              ))}
            </g>
          </svg>
          {akislar
            .filter((a) => a.etiket)
            .map((a) => (
              <span key={`e-${a.kaynak}-${a.hedef}`} className="cizgi-etiket" style={{ left: a.yol.etiket.x, top: a.yol.etiket.y }}>
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
              const stil: CSSProperties = { left: k.x, top: k.y, width: k.w, minHeight: k.h, opacity: eslesir(p) ? 1 : 0.15 };
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
                  <span className="asamalar">
                    {[1, 2, 3, 4].map((i) => <span key={i} className={`asama${p.asamaSira >= i ? " on" : ""}`} />)}
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
