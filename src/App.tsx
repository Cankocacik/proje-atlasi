import { useState, type CSSProperties } from "react";
import type { Proje } from "./types";
import { useAtlas } from "./hooks/useAtlas";
import { Harita } from "./components/Harita";
import { Detay } from "./components/Detay";
import { Adimlar, Kenar, Liste, ManifestSorunlari, OzetSeridi, YayinHatti } from "./components/Paneller";
import { Giris } from "./components/Giris";
import { Loglar } from "./components/Loglar";
import { Olaylar } from "./components/Olaylar";
import { Denetim } from "./components/Denetim";
import { useBildirim } from "./hooks/useBildirim";
import { goreli } from "./lib/zaman";
import { Svg } from "./components/Ikon";

type Filtre = "hepsi" | "canli" | "gelistirme" | "dikkat";
const FILTRELER: { id: Filtre; ad: string; uyar: (p: Proje) => boolean }[] = [
  { id: "hepsi", ad: "Tüm projeler", uyar: () => true },
  { id: "canli", ad: "Canlı", uyar: (p) => p.asama === "canli" },
  { id: "gelistirme", ad: "Geliştirmede", uyar: (p) => p.asama === "gelistirme" },
  { id: "dikkat", ad: "Dikkat bekleyen", uyar: (p) => p.uyarilar.length > 0 },
];

export function App() {
  const { oturum, girisGerekli, girisTuru, giris, cikis, veri, bagli, hata, simdi, tara, taraniyor, adimIsaretle, repoAc, loglar, logYukle, denetle, denetleniyor, bildirimDene } = useAtlas();
  const [secili, setSecili] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("hepsi");
  const [arama, setArama] = useState("");
  const [gorunum, setGorunum] = useState<"harita" | "liste">("harita");
  const [yakinlik, setYakinlik] = useState(100);
  const { izin, izinIste } = useBildirim(veri?.olaylar, veri ? veri.projeler.filter((x) => x.uyarilar.length > 0).length : 0);

  if (oturum === "giris") return <Giris giris={giris} girisTuru={girisTuru} />;
  if (!veri) return <div className="yukleniyor" role="status"><Svg ad="harita" boyut={32} /><span>{hata ?? "Projelerin yükleniyor…"}</span></div>;

  const durumUyar = FILTRELER.find((f) => f.id === filtre)!.uyar;
  const sorgu = arama.trim().toLocaleLowerCase("tr-TR");
  const eslesir = (p: Proje) => durumUyar(p) && (!sorgu || `${p.ad} ${p.tur} ${p.aciklama ?? ""}`.toLocaleLowerCase("tr-TR").includes(sorgu));
  const varsayilan = veri.projeler.find((p) => p.ikon === "hub") ?? veri.projeler[0];
  const p = veri.projeler.find((x) => x.id === secili) ?? varsayilan;
  const uyariSayisi = veri.projeler.filter((x) => x.uyarilar.length > 0).length;
  const senkron = Math.max(0, Math.round((simdi.getTime() - new Date(veri.zaman).getTime()) / 1000));
  const kok = { "--acc": veri.gorunum.vurgu ?? "#C4F56A" } as CSSProperties;
  const sonucSayisi = veri.projeler.filter(eslesir).length;

  return (
    <div className="uygulama" style={kok}>
      <Kenar veri={veri} cikis={girisGerekli ? cikis : undefined} />
      <main className="ana">
        <header className="ust">
          <div className="ust-metin">
            <div className="kirinti"><span>Çalışma alanı</span><span className="ayrac">/</span><span>Proje haritası</span><span className="ortam-rozet">{veri.ortam === "sunucu" ? "SUNUCU" : "YEREL"}</span></div>
            <h1 className="manset">Her şey gözünün önünde.</h1>
            <p className="alt-baslik">Projelerin, bağlantıların ve sıradaki adımların.
              {uyariSayisi > 0 && <a className="dikkat-ozet" href="#detay" onClick={() => setSecili(veri.projeler.find((x) => x.uyarilar.length > 0)!.id)}>{uyariSayisi} proje dikkatini bekliyor <span aria-hidden="true">↗</span></a>}
            </p>
          </div>
          <div className="ust-sag">
            <div className="canli" role="status" title={`Son veri ${senkron} saniye önce alındı`}>
              <span className={`canli-nokta${bagli ? " nabiz" : " kopuk"}`} />
              <span className={`canli-yazi${bagli ? "" : " kopuk"}`}>{bagli ? "CANLI" : "BAĞLANTI YOK"}</span>
              <time className="canli-saat">{simdi.toLocaleTimeString("tr-TR")}</time>
            </div>
            <button type="button" className="cta" onClick={tara} disabled={taraniyor}><Svg ad="yenile" boyut={17} />{taraniyor ? "Taranıyor…" : "Şimdi tara"}</button>
          </div>
        </header>

        {(hata || veri.manifestHatasi) && <div className="hata-serit" role="alert">{veri.manifestHatasi ?? hata}</div>}
        <ManifestSorunlari sorunlar={veri.manifestSorunlari} />
        <OzetSeridi veri={veri} />

        <div className="atlas-izgara">
          <div className="sol-sutun">
            <section id="harita" className="panel harita-panel" aria-label="Proje haritası">
              <div className="harita-ust">
                <div className="panel-baslik-grup"><h2 className="panel-baslik">Proje haritası</h2><span className="panel-sayac">{veri.projeler.length}</span></div>
                <div className="harita-araclar">
                  <label className="gizli" htmlFor="proje-filtre">Projeleri duruma göre süz</label>
                  <select id="proje-filtre" className="alan filtre-sec" value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>{FILTRELER.map((f) => <option key={f.id} value={f.id}>{f.ad} ({veri.projeler.filter(f.uyar).length})</option>)}</select>
                  <div className="seg" role="group" aria-label="Görünüm">
                    <button type="button" className={`seg-btn${gorunum === "harita" ? " on" : ""}`} aria-pressed={gorunum === "harita"} onClick={() => setGorunum("harita")}><Svg ad="harita" boyut={15} />Harita</button>
                    <button type="button" className={`seg-btn${gorunum === "liste" ? " on" : ""}`} aria-pressed={gorunum === "liste"} onClick={() => setGorunum("liste")}><Svg ad="liste" boyut={15} />Liste</button>
                  </div>
                </div>
              </div>
              <div className="harita-arama-serit">
                <label className="harita-arama"><Svg ad="ara" boyut={16} /><span className="gizli">Projelerde ara</span><input type="search" placeholder="Bir proje bul…" value={arama} onChange={(e) => setArama(e.target.value)} /></label>
                <span className="mono sessiz harita-sonuc" role="status">{sorgu || filtre !== "hepsi" ? `${sonucSayisi} / ${veri.projeler.length} eşleşme` : "Projelerin ve modüllerin aynı haritada"}</span>
              </div>
              {gorunum === "harita" ? <>
                <Harita veri={veri} secili={p?.id ?? ""} sec={setSecili} eslesir={eslesir} olcek={yakinlik / 100} radar={veri.gorunum.radar !== false} simdi={simdi} />
                <div className="harita-alt">
                  <div className="lejant"><span><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="1.2" /></svg>Modül bağı</span><span><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--acc)" strokeWidth="1.4" strokeDasharray="4 4" /></svg>Veri akışı</span><span className="st-live"><span className="dot" />Canlı</span><span className="st-dev"><span className="dot" />Geliştirmede</span><span className="st-warn"><span className="dot" />Dikkat</span></div>
                  <div className="yakinlik"><button type="button" className="ibtn" aria-label="Uzaklaştır" disabled={yakinlik <= 60} onClick={() => setYakinlik((z) => Math.max(60, z - 10))}><Svg ad="eksi" boyut={15} /></button><button type="button" className="yakinlik-sifirla mono" title="Haritayı ekrana sığdır" onClick={() => setYakinlik(100)}>{yakinlik}%</button><button type="button" className="ibtn" aria-label="Yakınlaştır" disabled={yakinlik >= 140} onClick={() => setYakinlik((z) => Math.min(140, z + 10))}><Svg ad="arti" boyut={15} /></button></div>
                </div>
              </> : <Liste veri={veri} sec={setSecili} eslesir={eslesir} simdi={simdi} />}
              {sonucSayisi === 0 && <p className="harita-bos" role="status">Bu süzgece uyan proje yok. <button type="button" onClick={() => { setFiltre("hepsi"); setArama(""); }}>Süzgeçleri temizle</button></p>}
            </section>
            <Olaylar veri={veri} simdi={simdi} sec={setSecili} izin={izin} izinIste={izinIste} bildirimDene={bildirimDene} />
            <Adimlar veri={veri} isaretle={adimIsaretle} />
            <YayinHatti veri={veri} sec={setSecili} />
            <Loglar veri={veri} loglar={loglar} logYukle={logYukle} />
            <Denetim denetim={veri.denetim} denetle={denetle} denetleniyor={denetleniyor} simdi={simdi} />
            <footer className="sayfa-alt"><span className={`canli-nokta${bagli ? "" : " kopuk"}`} /><span>{bagli ? "Canlı veriler bağlı" : "Yeniden bağlanılıyor"}</span>{veri.atlas?.commit && <span title={veri.atlas.mesaj ?? undefined}>· Atlas {veri.atlas.commit} · {goreli(veri.atlas.baslangic, simdi)} açıldı</span>}{veri.atlas?.derlemeEski && <span className="sayfa-alt-uyari">· arayüz eski derleme ({veri.atlas.derleme}) — scripts/guncelle.ps1</span>}<span className="sayfa-alt-zaman">Son senkron: {senkron} sn önce</span></footer>
          </div>
          {p ? <Detay veri={veri} p={p} simdi={simdi} sec={setSecili} repoAc={veri.ortam === "yerel" && !girisGerekli ? repoAc : undefined} /> : <aside className="panel detay"><p className="sessiz">İzlenecek projeler manifest eklendiğinde burada görünecek.</p></aside>}
        </div>
      </main>
    </div>
  );
}
