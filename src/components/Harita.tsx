import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import type { Anlik, Proje } from "../types";
import { dirsekYol, kutuBul, merkez } from "../lib/geometri";
import { ASAMA_ETIKET, durumEtiketi } from "../lib/etiket";
import { goreli } from "../lib/zaman";
import { projeIlerlemesi } from "../lib/ilerleme";
import { OK_YONU, yondekiKomsu } from "../lib/komsu";
import { useHareketAzalt } from "../hooks/useEtkilesim";
import { ProjeIkon } from "./Ikon";

interface Props {
  veri: Anlik;
  secili: string;
  sec: (id: string) => void;
  eslesir: (p: Proje) => boolean;
  olcek: number;
  radar: boolean;
  simdi: Date;
  /** Ctrl + tekerlek ile yakınlaştırma (yüzde puanı). */
  yakinlas?: (fark: number) => void;
  /** Duvar modu: harita kabın iki boyutuna sığdırılır (1'den büyük olabilir). */
  sigdir?: boolean;
}

const MENZIL = [130, 230, 330, 430];

/** Fareyle üstüne gelinen / klavyeyle odaklanan düğümün kısa künyesi (yalnız gerçek alanlar). */
function Ipucu({ p, veri, simdi }: { p: Proje; veri: Anlik; simdi: Date }) {
  const k = kutuBul(p);
  const asagi = k.y < 120;
  const stil: CSSProperties = {
    left: k.x + k.w / 2,
    top: asagi ? k.y + (k.h || 0) + (p.kart ? 10 : 34) : k.y - (p.kart ? 10 : 30),
    transform: `translate(-50%, ${asagi ? "0" : "-100%"})`,
  };
  const son = p.git?.son;
  const surecler = (p.surecler ?? []).map((ad) => ({ ad, durum: veri.surecler?.find((s) => s.ad === ad)?.durum ?? "yok" }));
  const bekleyen = p.git?.bekleyen?.toplam ?? p.git?.bekleyen?.commitler.length ?? 0;
  return (
    <div className={`ipucu st-${p.durum}`} style={stil} role="tooltip">
      <div className="ipucu-ust">
        <span className="dot" />
        <b>{p.ad}</b>
        <span className="mono sessiz">{p.tur}</span>
      </div>
      <dl>
        <dt>Durum</dt><dd>{durumEtiketi(p)}</dd>
        {p.saglik && <><dt>Site</dt><dd className="mono">{p.saglik.ok ? `${p.saglik.kod} · ${p.saglik.ms} ms` : `yanıt yok (${p.saglik.kod ?? p.saglik.hata})`}</dd></>}
        {p.saglikGecmisi?.yuzde != null && <><dt>24 sa</dt><dd className="mono">%{p.saglikGecmisi.yuzde} erişim</dd></>}
        {son && <><dt>Son commit</dt><dd><span className="mono">{goreli(son.tarih, simdi)}</span> · {son.mesaj.length > 46 ? `${son.mesaj.slice(0, 46)}…` : son.mesaj}</dd></>}
        {surecler.length > 0 && <><dt>pm2</dt><dd className="mono">{surecler.map((s) => `${s.ad}: ${s.durum}`).join(" · ")}</dd></>}
        {bekleyen > 0 && <><dt>{veri.ortam === "sunucu" ? "Canlıya bekleyen" : "Çekilmemiş"}</dt><dd className="mono">{bekleyen} commit</dd></>}
      </dl>
      {p.uyarilar.length > 0 && (
        <div className={`ipucu-uyari${p.uyarilar.some((u) => u.seviye === "yuksek") ? " yuksek" : ""}`}>
          {p.uyarilar[0].metin}{p.uyarilar.length > 1 ? ` · +${p.uyarilar.length - 1}` : ""}
        </div>
      )}
    </div>
  );
}

export function Harita({ veri, secili, sec, eslesir, olcek, radar, simdi, yakinlas, sigdir = false }: Props) {
  const { genislik: G, yukseklik: Y } = veri.harita;
  const zemin = useRef<HTMLDivElement>(null);
  const [kap, setKap] = useState({ w: G, h: Y });
  const [uzerinde, setUzerinde] = useState<string | null>(null);
  const [suruklen, setSuruklen] = useState(false);
  const surukle = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const azalt = useHareketAzalt();
  const yakinlasRef = useRef(yakinlas);
  yakinlasRef.current = yakinlas;

  useEffect(() => {
    if (!zemin.current) return;
    const gozlemci = new ResizeObserver(([giris]) => setKap({ w: giris.contentRect.width, h: giris.contentRect.height }));
    gozlemci.observe(zemin.current);
    return () => gozlemci.disconnect();
  }, []);

  // Ctrl + tekerlek (ve dokunmatik yüzeyde kıstırma) yakınlaştırır; sayfa kaydırması bozulmaz.
  useEffect(() => {
    const el = zemin.current;
    if (!el) return;
    let birikim = 0;
    const teker = (e: WheelEvent) => {
      if (!e.ctrlKey || !yakinlasRef.current) return;
      e.preventDefault();
      birikim += e.deltaY;
      if (Math.abs(birikim) >= 40) {
        yakinlasRef.current(birikim < 0 ? 10 : -10);
        birikim = 0;
      }
    };
    el.addEventListener("wheel", teker, { passive: false });
    return () => el.removeEventListener("wheel", teker);
  }, []);

  // Küçük ekranlarda okunabilirlik için harita kendi içinde kaydırılır; duvar modunda kaba sığar.
  const gercekOlcek = sigdir
    ? Math.max(0.3, Math.min((kap.w - 16) / G, (kap.h - 16) / Y))
    : Math.max(0.72, Math.min(1, (kap.w - 24) / G)) * olcek;
  const byId = new Map(veri.projeler.map((p) => [p.id, p]));
  const hub = veri.projeler.find((p) => p.ikon === "hub" && p.kart);
  const hubMerkez = hub ? merkez(kutuBul(hub)) : { x: G / 2, y: Y / 2 };

  const altBaglar = veri.projeler
    .filter((p) => p.ust && byId.get(p.ust))
    .map((p) => ({
      id: p.id,
      yol: dirsekYol(kutuBul(byId.get(p.ust!)!), kutuBul(p)),
      etkin: eslesir(p) || eslesir(byId.get(p.ust!)!),
      vurgu: p.id === secili || p.ust === secili,
    }));

  const akislar = veri.akislar
    .filter((a) => byId.has(a.kaynak) && byId.has(a.hedef))
    .map((a) => ({
      ...a,
      etkin: eslesir(byId.get(a.kaynak)!) || eslesir(byId.get(a.hedef)!),
      vurgu: a.kaynak === secili || a.hedef === secili,
      yol: dirsekYol(kutuBul(byId.get(a.kaynak)!), kutuBul(byId.get(a.hedef)!)),
    }));

  const noktalar = veri.projeler.map((p) => ({ id: p.id, ...merkez(kutuBul(p)) }));
  const okTusu = (e: KeyboardEvent<HTMLDivElement>) => {
    const yon = OK_YONU[e.key];
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
    if (!yon || !id) return;
    const sonraki = yondekiKomsu(noktalar, id, yon);
    if (!sonraki) return;
    e.preventDefault();
    sec(sonraki);
    zemin.current?.querySelector<HTMLElement>(`[data-id="${sonraki}"]`)?.focus();
  };

  // Harita kabından taşıyorsa (yakınlaştırınca) sürükleyerek gezilir.
  const basla = (e: RPointerEvent<HTMLDivElement>) => {
    const el = zemin.current;
    if (!el || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
    surukle.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    setSuruklen(true);
  };
  const tasi = (e: RPointerEvent<HTMLDivElement>) => {
    const s = surukle.current;
    if (!s || !zemin.current) return;
    zemin.current.scrollLeft = s.sl - (e.clientX - s.x);
    zemin.current.scrollTop = s.st - (e.clientY - s.y);
  };
  const birak = () => {
    surukle.current = null;
    setSuruklen(false);
  };

  const ustteki = uzerinde ? byId.get(uzerinde) : undefined;
  const odak = (id: string) => ({
    onPointerEnter: () => setUzerinde(id),
    onPointerLeave: () => setUzerinde((u) => (u === id ? null : u)),
    onFocus: () => setUzerinde(id),
    onBlur: () => setUzerinde((u) => (u === id ? null : u)),
  });

  return (
    <div
      className={`harita-zemin${sigdir ? " sigdir" : ""}${suruklen ? " suruklen" : ""}`}
      ref={zemin}
      onKeyDown={okTusu}
      onPointerDown={basla}
      onPointerMove={tasi}
      onPointerUp={birak}
      onPointerCancel={birak}
    >
      <div style={{ width: Math.round(G * gercekOlcek), height: Math.round(Y * gercekOlcek), margin: sigdir ? "auto" : "12px auto", position: "relative", flex: "none" }}>
        <div className="harita-tuval" style={{ width: G, height: Y, transform: `scale(${gercekOlcek})` }}>
          {radar && (
            <div className="tarama" style={{ left: hubMerkez.x, top: hubMerkez.y, width: G * 1.1, height: G * 1.1 }} />
          )}
          <svg width={G} height={Y} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "visible" }} aria-hidden="true">
            <defs>
              <marker id="ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--acc)" />
              </marker>
              <radialGradient id="parcacik">
                <stop offset="0" stopColor="var(--acc)" stopOpacity="1" />
                <stop offset=".45" stopColor="var(--acc)" stopOpacity=".5" />
                <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Menzil halkaları + nişangâh: merkez (hub) etrafında ölçek hissi. */}
            <g className="menzil">
              {MENZIL.map((r) => <circle key={r} cx={hubMerkez.x} cy={hubMerkez.y} r={r} />)}
              <path d={`M${hubMerkez.x} 0V${Y}M0 ${hubMerkez.y}H${G}`} className="nisangah" />
            </g>
            <g className="bag-katmani" fill="none">
              {altBaglar.map((b) => (
                <path key={b.id} d={b.yol.d} className={`bag${b.vurgu ? " vurgu" : ""}`} opacity={b.etkin ? 1 : 0.12} />
              ))}
            </g>
            <g stroke="var(--acc)" fill="none">
              {akislar.map((a) => (
                <path key={`${a.kaynak}-${a.hedef}`} className={`akan${a.vurgu ? " vurgu" : ""}`} d={a.yol.d} markerEnd="url(#ok)" opacity={a.etkin ? 0.8 : 0.12} />
              ))}
            </g>
            {/* Veri akışı boyunca ilerleyen parçacıklar; seçili düğümün modül bağlarında da akar. */}
            {!azalt && (
              <g className="parcaciklar">
                {akislar.filter((a) => a.etkin).map((a, i) =>
                  [0, 1].map((j) => (
                    <circle key={`${a.kaynak}-${a.hedef}-${j}`} r={a.vurgu ? 4.5 : 3.5} fill="url(#parcacik)">
                      <animateMotion dur={`${3.4 + (i % 3) * 0.4}s`} begin={`-${j * 1.7 + i * 0.35}s`} repeatCount="indefinite" path={a.yol.d} />
                    </circle>
                  )),
                )}
                {altBaglar.filter((b) => b.vurgu && b.etkin).map((b, i) => (
                  <circle key={`b-${b.id}`} r="3.5" fill="url(#parcacik)">
                    <animateMotion dur="2.6s" begin={`-${i * 0.3}s`} repeatCount="indefinite" path={b.yol.d} />
                  </circle>
                ))}
              </g>
            )}
          </svg>
          {akislar
            .filter((a) => a.etiket)
            .map((a) => (
              <span key={`e-${a.kaynak}-${a.hedef}`} className={`cizgi-etiket${a.vurgu ? " vurgu" : ""}`} style={{ left: a.yol.etiket.x, top: a.yol.etiket.y, opacity: a.etkin ? 1 : 0.15 }}>
                {a.etiket}
              </span>
            ))}

          {veri.projeler
            .filter((p) => !p.kart)
            .map((p, i) => (
              <button
                key={p.id}
                type="button"
                data-id={p.id}
                className={`dn st-${p.durum}${p.uyarilar.length ? " uyari" : ""}${p.id === secili ? " sec" : ""}`}
                style={{ left: p.konum.x, top: p.konum.y, opacity: eslesir(p) ? 1 : 0.15, ["--i" as string]: i }}
                aria-pressed={p.id === secili}
                aria-label={`${p.ad}, ${durumEtiketi(p)}${p.uyarilar.length ? `, ${p.uyarilar.length} uyarı` : ""}`}
                onClick={() => sec(p.id)}
                {...odak(p.id)}
              >
                <span className="cekirdek" />
                <span className="etiket">{p.ad}</span>
              </button>
            ))}

          {veri.projeler
            .filter((p) => p.kart)
            .map((p, i) => {
              const k = kutuBul(p);
              const ilerleme = projeIlerlemesi(veri, p.id);
              const stil: CSSProperties = { left: k.x, top: k.y, width: k.w, height: k.h, opacity: eslesir(p) ? 1 : 0.15, ["--i" as string]: i };
              const nabiz = p.saglikGecmisi && p.saglikGecmisi.ornek > 0 ? p.saglikGecmisi.kutular : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-id={p.id}
                  className={`kart st-${p.durum}${p.ikon === "hub" ? " hub" : ""}${p.id === secili ? " sec" : ""}`}
                  style={stil}
                  aria-pressed={p.id === secili}
                  aria-label={`${p.ad}, ${durumEtiketi(p)}${p.uyarilar.length ? `, ${p.uyarilar.length} uyarı` : ""}`}
                  onClick={() => sec(p.id)}
                  {...odak(p.id)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                    <span className="ico"><ProjeIkon tur={p.ikon} /></span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, alignItems: "flex-start" }}>
                      <span className="kart-isim">{p.ad}</span>
                      <span className="pill"><span className="dot" style={{ width: 6, height: 6 }} />{durumEtiketi(p)}</span>
                    </span>
                  </span>
                  <span className="kart-ilerleme">
                    <span className="kart-ilerleme-metin"><span>{ilerleme.toplam ? `${ilerleme.tamam} / ${ilerleme.toplam} adım` : ASAMA_ETIKET[p.asama]}</span><span>{ilerleme.yuzde !== null ? `${ilerleme.yuzde}%` : p.saglik?.ok && p.saglik.ms != null ? `${p.saglik.ms} ms` : ""}</span></span>
                    {ilerleme.yuzde !== null ? <span className="ilerleme-cubuk"><span style={{ width: `${ilerleme.yuzde}%` }} /></span> : <span className="asamalar">{[1, 2, 3, 4].map((n) => <span key={n} className={`asama${p.asamaSira >= n ? " on" : ""}`} />)}</span>}
                  </span>
                  <span className="kart-alt">
                    <span>{p.surum ?? p.git?.son?.kisa ?? "—"}</span>
                    <span>{p.git?.son ? goreli(p.git.son.tarih, simdi) : "git yok"}</span>
                  </span>
                  {nabiz && (
                    <span className="kart-nabiz" aria-hidden="true" title={`Son 24 saat erişim %${p.saglikGecmisi!.yuzde}`}>
                      {nabiz.map((d, j) => <i key={j} className={d ?? "bos"} />)}
                    </span>
                  )}
                  {p.uyarilar.length > 0 && <span className={`ping${p.uyarilar.some((u) => u.seviye === "yuksek") ? " yuksek" : ""}`} />}
                </button>
              );
            })}

          {ustteki && <Ipucu p={ustteki} veri={veri} simdi={simdi} />}
        </div>
      </div>
    </div>
  );
}
