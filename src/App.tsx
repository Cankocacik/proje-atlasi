import { useState, type CSSProperties } from "react";
import type { Proje } from "./types";
import { useAtlas } from "./hooks/useAtlas";
import { Harita } from "./components/Harita";
import { Detay } from "./components/Detay";
import { Adimlar, Kenar, Liste, OzetSeridi, YayinHatti } from "./components/Paneller";
import { Giris } from "./components/Giris";
import { Loglar } from "./components/Loglar";
import { Svg } from "./components/Ikon";

type Filtre = "hepsi" | "canli" | "gelistirme" | "dikkat";

const FILTRELER: { id: Filtre; ad: string; uyar: (p: Proje) => boolean }[] = [
  { id: "hepsi", ad: "Tümü", uyar: () => true },
  { id: "canli", ad: "Canlı", uyar: (p) => p.asama === "canli" },
  { id: "gelistirme", ad: "Geliştirmede", uyar: (p) => p.asama === "gelistirme" },
  { id: "dikkat", ad: "Dikkat", uyar: (p) => p.uyarilar.length > 0 },
];

export function App() {
  const { oturum, girisGerekli, girisTuru, giris, cikis, veri, bagli, hata, simdi, tara, taraniyor, adimIsaretle, repoAc, loglar, logYukle } = useAtlas();
  const [secili, setSecili] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("hepsi");
  const [gorunum, setGorunum] = useState<"harita" | "liste">("harita");
  const [yakinlik, setYakinlik] = useState(100);

  if (oturum === "giris") return <Giris giris={giris} girisTuru={girisTuru} />;
  if (!veri) {
    return <div className="yukleniyor">{hata ?? "Projeler taranıyor…"}</div>;
  }

  const eslesir = FILTRELER.find((f) => f.id === filtre)!.uyar;
  const varsayilan = veri.projeler.find((p) => p.ikon === "hub") ?? veri.projeler[0];
  const p = veri.projeler.find((x) => x.id === secili) ?? varsayilan;
  const uyariSayisi = veri.projeler.reduce((t, x) => t + x.uyarilar.length, 0);
  const senkron = Math.max(0, Math.round((simdi.getTime() - new Date(veri.zaman).getTime()) / 1000));
  const kok = { "--acc": veri.gorunum.vurgu ?? "#C6F24E" } as CSSProperties;

  return (
    <div className="uygulama" style={kok}>
      <Kenar veri={veri} cikis={girisGerekli ? cikis : undefined} />
      <main className="ana">
        <header className="ust">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="kirinti" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>Çalışma alanı <span style={{ color: "#3a4558" }}>/</span> Proje haritası</span>
              <span className="ortam-rozet">{veri.ortam === "sunucu" ? "SUNUCU" : "YEREL"}</span>
            </div>
            <h1 className="manset">{uyariSayisi > 0 ? `${uyariSayisi} iş dikkatini bekliyor.` : "Her şey kontrol altında."}</h1>
            <p className="alt-baslik">Projelerin, bağlantıların ve sıradaki adımların — canlı.</p>
          </div>
          <div className="ust-sag">
            <div className="canli" role="status">
              <span className={`canli-nokta nabiz${bagli ? "" : " kopuk"}`} />
              <span className={`canli-yazi${bagli ? "" : " kopuk"}`}>{bagli ? "CANLI" : "BAĞLANTI YOK"}</span>
              <span style={{ color: "#fff", fontSize: 13 }}>{simdi.toLocaleTimeString("tr-TR")}</span>
              <span className="sessiz" style={{ fontSize: 11.5 }}>senkron {senkron} sn</span>
            </div>
            <button type="button" className="cta" onClick={tara} disabled={taraniyor}>
              <Svg ad="yenile" boyut={18} />{taraniyor ? "Taranıyor…" : "Şimdi tara"}
            </button>
          </div>
        </header>

        {(hata || veri.manifestHatasi) && <div className="hata-serit" role="alert">{veri.manifestHatasi ?? hata}</div>}

        <OzetSeridi veri={veri} />

        <div className="izgara">
          <div className="sol-sutun">
            <section id="harita" className="panel" aria-label="Proje haritası" style={{ overflow: "hidden" }}>
              <div className="harita-ust">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 className="panel-baslik">Proje haritası</h2>
                  <span className="mono sessiz" style={{ fontSize: 11.5 }}>
                    {veri.projeler.filter(eslesir).length}/{veri.projeler.length} düğüm
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <div role="group" aria-label="Haritayı süz" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {FILTRELER.map((f) => (
                      <button key={f.id} type="button" className={`fbtn${filtre === f.id ? " on" : ""}`} aria-pressed={filtre === f.id} onClick={() => setFiltre(f.id)}>
                        {f.ad} <span style={{ opacity: 0.65 }}>{veri.projeler.filter(f.uyar).length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="seg" role="group" aria-label="Görünüm">
                    <button type="button" className={`seg-btn${gorunum === "harita" ? " on" : ""}`} aria-pressed={gorunum === "harita"} onClick={() => setGorunum("harita")}>
                      <Svg ad="harita" boyut={15} />Harita
                    </button>
                    <button type="button" className={`seg-btn${gorunum === "liste" ? " on" : ""}`} aria-pressed={gorunum === "liste"} onClick={() => setGorunum("liste")}>
                      <Svg ad="liste" boyut={15} />Liste
                    </button>
                  </div>
                </div>
              </div>

              {gorunum === "harita" ? (
                <>
                  <Harita veri={veri} secili={p.id} sec={setSecili} eslesir={eslesir} olcek={yakinlik / 100} radar={veri.gorunum.radar !== false} simdi={simdi} />
                  <div className="harita-alt">
                    <div className="lejant">
                      <span><svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="rgba(174,183,198,.6)" strokeWidth="1.4" /></svg>Modül bağı</span>
                      <span style={{ color: "var(--live)" }}><svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--live)" strokeWidth="1.4" strokeDasharray="4 4" /></svg>Veri / kod akışı</span>
                      <span className="st-live"><span className="dot" />Canlı</span>
                      <span className="st-dev"><span className="dot" />Geliştirmede</span>
                      <span className="st-warn"><span className="dot" />Dikkat</span>
                      <span className="st-idle"><span className="dot" />Beklemede</span>
                    </div>
                    <div className="yakinlik">
                      <button type="button" className="ibtn" aria-label="Uzaklaştır" onClick={() => setYakinlik((z) => Math.max(60, z - 10))}><Svg ad="eksi" boyut={16} /></button>
                      <span className="mono" style={{ minWidth: 52, textAlign: "center", fontSize: 12 }}>%{yakinlik}</span>
                      <button type="button" className="ibtn" aria-label="Yakınlaştır" onClick={() => setYakinlik((z) => Math.min(140, z + 10))}><Svg ad="arti" boyut={16} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <Liste veri={veri} sec={setSecili} eslesir={eslesir} simdi={simdi} />
              )}
            </section>

            <Loglar veri={veri} loglar={loglar} logYukle={logYukle} />

            <div className="izgara">
              <Adimlar veri={veri} isaretle={adimIsaretle} />
              <YayinHatti veri={veri} sec={setSecili} />
            </div>
          </div>

          <Detay veri={veri} p={p} simdi={simdi} sec={setSecili} repoAc={veri.ortam === "yerel" && !girisGerekli ? repoAc : undefined} />
        </div>
      </main>
    </div>
  );
}
