import type { Anlik, Proje } from "../types";
import { durumEtiketi } from "../lib/etiket";
import { gunFarki, goreli, tarihSaat } from "../lib/zaman";
import { ASAMA_ETIKET } from "../lib/etiket";
import { projeIlerlemesi, projeKapsami } from "../lib/ilerleme";
import { kutuAraligi } from "../lib/olay";
import { egriYolu } from "../lib/egri";
import { Bekleyen } from "./Bekleyen";
import { IcSaglik } from "./IcSaglik";
import { ProjeIkon, Svg } from "./Ikon";

interface Props {
  veri: Anlik;
  p: Proje;
  simdi: Date;
  sec: (id: string) => void;
  /** Yalnız yerel kullanımda verilir (sunucuda VS Code açılamaz). */
  repoAc?: (id: string) => void;
}

const KAYNAK_AD = { elle: "not", git: "git", saglik: "site", pm2: "pm2", denetim: "kurulum", icsaglik: "iç" } as const;
const KUTU_AD = { ok: "erişilebilir", kismi: "kısmi kesinti", hata: "kesinti" } as const;

const EG = 280;
const EY = 46;

/** Son 24 saatin yanıt süresi (30 dk kutu ortalaması). Veri olmayan aralık boş kalır. */
function YanitEgrisi({ sureler }: { sureler: (number | null)[] }) {
  const e = egriYolu(sureler, EG, EY);
  if (!e.cizgi) return null;
  return (
    <div className="egri" role="img" aria-label={`Son 24 saatte yanıt süresi en az ${e.enAz} ms, en çok ${e.enCok} ms`}>
      <svg viewBox={`0 0 ${EG} ${EY}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="egri-dolgu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--dev)" stopOpacity=".32" />
            <stop offset="1" stopColor="var(--dev)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={e.alan} fill="url(#egri-dolgu)" />
        <path d={e.cizgi} fill="none" stroke="var(--dev)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {e.son && <span className="egri-uc" style={{ left: `${(e.son.x / EG) * 100}%`, top: `${(e.son.y / EY) * 100}%` }} />}
      <span className="egri-etiket mono">{e.enCok} ms</span>
      <span className="egri-etiket egri-alt mono">{e.enAz} ms</span>
    </div>
  );
}

export function Detay({ veri, p, simdi, sec, repoAc }: Props) {
  const byId = new Map(veri.projeler.map((x) => [x.id, x]));
  const cocuklar = veri.projeler.filter((x) => x.ust === p.id);
  const baglar = [
    ...(p.ust && byId.has(p.ust) ? [byId.get(p.ust)!] : []),
    ...cocuklar,
    ...veri.akislar.filter((a) => a.kaynak === p.id).map((a) => byId.get(a.hedef)),
    ...veri.akislar.filter((a) => a.hedef === p.id).map((a) => byId.get(a.kaynak)),
  ].filter((x, i, arr): x is Proje => Boolean(x) && arr.findIndex((y) => y?.id === x!.id) === i);

  const kapsam = projeKapsami(veri.projeler, p.id);
  const commitler = veri.akis.filter((c) => c.projeId && kapsam.has(c.projeId)).slice(0, 4);
  const ilerleme = projeIlerlemesi(veri, p.id);

  const son = p.git?.son;
  const saglikMetni = !p.saglik
    ? "izlenmiyor"
    : p.saglik.ok
      ? `${p.saglik.kod} · ${p.saglik.ms} ms`
      : `${p.saglik.kod ?? p.saglik.hata}`;

  return (
    <aside id="detay" className={`panel detay st-${p.durum}`} aria-label="Proje detayı">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="etiketcik">PROJE DETAYI</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--cok-sessiz)" }}>{p.tur}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="ico detay-ikon">
          <ProjeIkon tur={p.ikon} boyut={28} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
          <h3 className="disp" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.1 }}>{p.ad}</h3>
          <span className="pill" style={{ fontSize: 12, padding: "4px 12px" }}><span className="dot" style={{ width: 6, height: 6 }} />{durumEtiketi(p)}</span>
        </div>
      </div>
      {p.aciklama && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: "var(--yazi-2)" }}>{p.aciklama}</p>}

      <div className="detay-ilerleme">
        {ilerleme.yuzde !== null ? <>
          <div className="detay-ilerleme-baslik"><span className="detay-yuzde">{ilerleme.yuzde}%</span><span className="sessiz">Adım ilerlemesi</span></div>
          <div className="ilerleme-cubuk" role="progressbar" aria-label={`${p.ad} adım ilerlemesi`} aria-valuenow={ilerleme.yuzde} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${ilerleme.yuzde}%` }} /></div>
          <span className="sessiz">{ilerleme.tamam} / {ilerleme.toplam} adım tamamlandı{cocuklar.length ? " · modüller dahil" : ""}</span>
        </> : <div className="detay-ilerleme-baslik"><span className="detay-asama">{ASAMA_ETIKET[p.asama]}</span><span className="sessiz">Proje aşaması</span></div>}
        <span className="etiketcik asama-baslik">YAYIN AŞAMASI</span>
        <div className="asamalar" style={{ gap: 5 }}>
          {[1, 2, 3, 4].map((i) => <span key={i} className={`asama${p.asamaSira >= i ? " on" : ""}`} style={{ height: 8 }} />)}
        </div>
        <div className="mono asama-etiketleri">
          {["FİKİR", "GELİŞTİRME", "BEKLİYOR", "CANLI"].map((ad, i) => (
            <span key={ad} title={ad} className={Math.min(p.asamaSira, 4) === i + 1 ? "simdiki" : undefined}>{ad}</span>
          ))}
        </div>
      </div>

      <div className="son-degisiklik"><Svg ad="kod" boyut={16} /><span>Son commit</span><span className="mono" title={son ? tarihSaat(son.tarih) : undefined}>{son ? goreli(son.tarih, simdi) : "Kayıt yok"}</span></div>

      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: "1px solid var(--cizgi)", borderBottom: "1px solid var(--cizgi)" }}>
        {[
          // Sunucuda akış GitHub'dan okunur: elle sürüm yoksa bu "canlıdaki" değil "GitHub'daki son"dur.
          [p.surum ? "Sürüm" : veri.ortam === "sunucu" && p.git?.canlida ? "GitHub'daki son" : "Sürüm", p.surum ?? son?.kisa ?? "—"],
          veri.ortam === "sunucu" && p.git?.canlida
            ? ["Canlıdaki commit", `${p.git.canlida}${p.git.geride ? ` (${p.git.geride} geride)` : ""}`]
            : ["Dal", p.git?.dal ? `${p.git.dal}${p.git.kaynak === "github" ? " · GitHub" : ""}` : "—"],
          ["Site", saglikMetni],
          p.surecler?.length
            ? ["pm2", p.surecler.map((ad) => `${ad}: ${veri.surecler?.find((s) => s.ad === ad)?.durum ?? "yok"}`).join(", ")]
            : ["Commit edilmemiş", p.git?.var && p.git.degisen != null ? `${p.git.degisen} dosya` : "—"],
        ].map(([ad, deger], i) => (
          <div key={ad} style={{ padding: "12px 0", paddingLeft: i % 2 ? 14 : 0, borderLeft: i % 2 ? "1px solid var(--cizgi)" : undefined, borderTop: i > 1 ? "1px solid var(--cizgi)" : undefined }}>
            <dt className="mono" style={{ fontSize: 11, color: "var(--sessiz)", marginBottom: 6 }}>{ad}</dt>
            <dd className="mono" style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 500, overflowWrap: "anywhere" }}>{deger}</dd>
          </div>
        ))}
      </dl>

      {p.saglikGecmisi && p.saglikGecmisi.ornek > 0 && (
        <div className="erisim">
          <div className="erisim-baslik">
            <span className="etiketcik">ERİŞİM VE YANIT · 24 SA</span>
            <span className="mono erisim-deger" title={p.saglikGecmisi.ortalamaMs != null ? `Ortalama yanıt ${p.saglikGecmisi.ortalamaMs} ms · ${p.saglikGecmisi.ornek} yoklama` : undefined}>
              %{p.saglikGecmisi.yuzde}
              {p.saglikGecmisi.ortalamaMs != null && <span className="sessiz"> · {p.saglikGecmisi.ortalamaMs} ms</span>}
            </span>
          </div>
          {p.saglikGecmisi.sureler && <YanitEgrisi sureler={p.saglikGecmisi.sureler} />}
          <div className="erisim-serit" role="img" aria-label={`Son 24 saatte erişilebilirlik yüzde ${p.saglikGecmisi.yuzde}, ${p.saglikGecmisi.ornek} yoklama`}>
            {p.saglikGecmisi.kutular.map((k, i, arr) => (
              <span key={i} className={`erisim-kutu ${k ?? "bos"}`} title={`${kutuAraligi(i, arr.length, simdi)} · ${k ? KUTU_AD[k] : "veri yok"}`} />
            ))}
          </div>
          <div className="erisim-alt mono"><span>24 sa önce</span><span>şimdi</span></div>
        </div>
      )}

      {p.icDurum && <IcSaglik d={p.icDurum} />}

      {p.git?.bekleyen && <Bekleyen bekleyen={p.git.bekleyen} ortam={veri.ortam} simdi={simdi} />}

      {p.uyarilar.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="etiketcik">DİKKAT</span>
          {p.uyarilar.map((u) => (
            <div key={u.metin} className={`uyari-kutu${u.seviye === "orta" ? " orta" : ""}`}>
              <span style={{ flex: "none", marginTop: 1 }}><Svg ad="uyari" boyut={16} /></span>
              <span style={{ flex: 1 }}>{u.metin}</span>
              <span className="mono" style={{ fontSize: 10, opacity: 0.75, whiteSpace: "nowrap" }} title={u.tarih ? `${u.tarih} tarihinde eklendi` : undefined}>
                {KAYNAK_AD[u.kaynak]}{u.tarih ? ` · ${gunFarki(u.tarih, simdi)} g` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="etiketcik">BAĞLANTILAR</span>
        {baglar.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {baglar.map((b) => (
              <button key={b.id} type="button" className={`lnk st-${b.durum}`} onClick={() => sec(b.id)}>
                <ProjeIkon tur={b.ikon} boyut={16} />{b.ad}
              </button>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "var(--sessiz)" }}>Bağımsız iş — başka düğüme bağlı değil.</span>
        )}
      </div>

      <div id="aktivite" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 }}>
          <span className="etiketcik">PROJE AKTİVİTESİ</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--sessiz)" }}>git akışı</span>
        </div>
        {commitler.length ? (
          <ol className="zaman-cizelgesi">
            {commitler.map((c) => {
              const sahip = c.projeId ? byId.get(c.projeId) : undefined;
              return (
                <li key={c.hash} className={`st-${sahip?.durum ?? "idle"}`}>
                  <span className="zc-nokta"><span className="dot" style={{ marginTop: 5, position: "relative", zIndex: 1 }} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, overflowWrap: "anywhere" }}>{c.mesaj}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--soluk)" }}>
                      {c.kisa}{sahip && sahip.id !== p.id ? ` · ${sahip.ad}` : ""}
                    </span>
                  </span>
                  <span className="mono" title={tarihSaat(c.tarih)} style={{ fontSize: 11, color: "var(--sessiz)", whiteSpace: "nowrap" }}>{goreli(c.tarih, simdi)}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <span style={{ fontSize: 13, color: "var(--sessiz)" }}>{p.repo || p.github ? "Son 21 günde commit yok." : "Bu düğüme repo bağlanmamış."}</span>
        )}
      </div>

      {p.url && (
        <a className="buyuk-dugme bos" href={p.url} target="_blank" rel="noreferrer">
          {p.url.replace(/^https?:\/\//, "")} <Svg ad="dis" boyut={16} />
        </a>
      )}
      {p.repo && repoAc && (
        <button type="button" className="buyuk-dugme dolu" onClick={() => repoAc(p.id)}>
          <Svg ad="kod" boyut={18} /> VS Code'da aç
        </button>
      )}
    </aside>
  );
}
