import type { Anlik, Proje } from "../types";
import { durumEtiketi } from "../lib/etiket";
import { gunFarki, goreli, tarihSaat } from "../lib/zaman";
import { ProjeIkon, Svg } from "./Ikon";

interface Props {
  veri: Anlik;
  p: Proje;
  simdi: Date;
  sec: (id: string) => void;
  /** Yalnız yerel kullanımda verilir (sunucuda VS Code açılamaz). */
  repoAc?: (id: string) => void;
}

const KAYNAK_AD = { elle: "not", git: "git", saglik: "site", pm2: "pm2" } as const;

export function Detay({ veri, p, simdi, sec, repoAc }: Props) {
  const byId = new Map(veri.projeler.map((x) => [x.id, x]));
  const cocuklar = veri.projeler.filter((x) => x.ust === p.id);
  const baglar = [
    ...(p.ust && byId.has(p.ust) ? [byId.get(p.ust)!] : []),
    ...cocuklar,
    ...veri.akislar.filter((a) => a.kaynak === p.id).map((a) => byId.get(a.hedef)),
    ...veri.akislar.filter((a) => a.hedef === p.id).map((a) => byId.get(a.kaynak)),
  ].filter((x, i, arr): x is Proje => Boolean(x) && arr.findIndex((y) => y?.id === x!.id) === i);

  const kapsam = new Set([p.id, ...cocuklar.map((c) => c.id)]);
  const commitler = veri.akis.filter((c) => c.projeId && kapsam.has(c.projeId)).slice(0, 6);

  const son = p.git?.son;
  const gun = son ? gunFarki(son.tarih, simdi) : null;
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
        <span className="ico" style={{ width: 60, height: 60, borderRadius: 14, borderWidth: 1.5, boxShadow: "0 0 22px color-mix(in srgb, var(--c) 30%, transparent)" }}>
          <ProjeIkon tur={p.ikon} boyut={28} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
          <h3 className="disp" style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.1 }}>{p.ad}</h3>
          <span className="pill" style={{ fontSize: 12, padding: "4px 12px" }}><span className="dot" style={{ width: 6, height: 6 }} />{durumEtiketi(p)}</span>
        </div>
      </div>
      {p.aciklama && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: "var(--yazi-2)" }}>{p.aciklama}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="disp" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, color: "var(--c)" }}>
            {gun === null ? "—" : gun <= 0 ? "Bugün" : `${gun} gün`}
          </span>
          <span style={{ fontSize: 13, color: "var(--soluk)" }}>
            {gun === null ? "git kaydı yok" : gun <= 0 ? "son commit" : "önce son commit"}
          </span>
        </div>
        <div className="asamalar" style={{ gap: 5 }}>
          {[1, 2, 3, 4].map((i) => <span key={i} className={`asama${p.asamaSira >= i ? " on" : ""}`} style={{ height: 8 }} />)}
        </div>
        <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 5, fontSize: 10, color: "var(--cok-sessiz)" }}>
          <span>FİKİR</span><span>GELİŞTİRME</span><span>BEKLİYOR</span><span>CANLI</span>
        </div>
      </div>

      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: "1px solid var(--cizgi)", borderBottom: "1px solid var(--cizgi)" }}>
        {[
          ["Sürüm", p.surum ?? son?.kisa ?? "—"],
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

      {p.uyarilar.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="etiketcik">DİKKAT</span>
          {p.uyarilar.map((u) => (
            <div key={u.metin} className={`uyari-kutu${u.seviye === "orta" ? " orta" : ""}`}>
              <span style={{ flex: "none", marginTop: 1 }}><Svg ad="uyari" boyut={16} /></span>
              <span style={{ flex: 1 }}>{u.metin}</span>
              <span className="mono" style={{ fontSize: 10, opacity: 0.75 }}>{KAYNAK_AD[u.kaynak]}</span>
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
                <span className="dot" />{b.ad}
              </button>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "var(--sessiz)" }}>Bağımsız iş — başka düğüme bağlı değil.</span>
        )}
      </div>

      <div id="aktivite" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 }}>
          <span className="etiketcik">SON COMMİTLER</span>
          <span className="mono nabiz" style={{ fontSize: 11, color: "var(--live)" }}>● izleniyor</span>
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
