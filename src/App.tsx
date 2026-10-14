import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Proje } from "./types";
import { useAtlas } from "./hooks/useAtlas";
import { Harita } from "./components/Harita";
import { Detay } from "./components/Detay";
import { Adimlar, Kenar, Liste, ManifestSorunlari, YayinHatti } from "./components/Paneller";
import { Giris } from "./components/Giris";
import { Loglar } from "./components/Loglar";
import { Olaylar } from "./components/Olaylar";
import { Denetim } from "./components/Denetim";
import { Vitaller, type VitalAnahtar } from "./components/Vitaller";
import { Palet, type PaletOgesi } from "./components/Palet";
import { Tostlar } from "./components/Tostlar";
import { Duvar } from "./components/Duvar";
import { useBildirim } from "./hooks/useBildirim";
import { useHareketAzalt, useKisayollar } from "./hooks/useEtkilesim";
import { durumCumlesi, vitaller } from "./lib/durumOzeti";
import { durumEtiketi } from "./lib/etiket";
import { goreli } from "./lib/zaman";
import { ProjeIkon, RadarLogo, Svg } from "./components/Ikon";

type Filtre = "hepsi" | "canli" | "gelistirme" | "dikkat";
const FILTRELER: { id: Filtre; ad: string; uyar: (p: Proje) => boolean }[] = [
  { id: "hepsi", ad: "Tüm projeler", uyar: () => true },
  { id: "canli", ad: "Canlı", uyar: (p) => p.asama === "canli" },
  { id: "gelistirme", ad: "Geliştirmede", uyar: (p) => p.asama === "gelistirme" },
  { id: "dikkat", ad: "Dikkat bekleyen", uyar: (p) => p.uyarilar.length > 0 },
];

const BOLUMLER = [
  { hash: "#ozet", ad: "Genel bakış", ikon: "ev" as const },
  { hash: "#harita", ad: "Proje haritası", ikon: "harita" as const },
  { hash: "#olaylar", ad: "Olay günlüğü", ikon: "zil" as const },
  { hash: "#adimlar", ad: "Sıradaki adımlar", ikon: "liste" as const },
  { hash: "#hat", ad: "Yayın hattı", ikon: "hat" as const },
  { hash: "#loglar", ad: "Sunucu & loglar", ikon: "kod" as const, anahtar: "pm2 log" },
  { hash: "#denetim", ad: "Kurulum denetimi", ikon: "kalkan" as const, anahtar: "doktor tünel dns" },
  { hash: "#detay", ad: "Proje detayı", ikon: "klasor" as const },
];

const DUVAR_ADRESI = "#duvar";

/** Canlı noktanın çevresinde sonraki otomatik taramaya kalan süre (veri tazeliği tek bakışta). */
function TaramaHalkasi({ gecen, aralik, bagli }: { gecen: number; aralik: number; bagli: boolean }) {
  const oran = Math.min(1, gecen / Math.max(1, aralik));
  const cevre = 2 * Math.PI * 6;
  const kalan = Math.max(0, aralik - gecen);
  return (
    <span className={`tarama-halkasi${bagli ? "" : " kopuk"}`} title={bagli ? (kalan ? `Sonraki tarama ~${kalan} sn` : "Tarama sürüyor") : "Bağlantı yok — yeniden deneniyor"}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" className="th-iz" />
        <circle cx="8" cy="8" r="6" className="th-dolu" strokeDasharray={`${cevre * (1 - oran)} ${cevre}`} transform="rotate(-90 8 8)" />
      </svg>
      <span className={`canli-nokta${bagli ? " nabiz" : " kopuk"}`} />
    </span>
  );
}

export function App() {
  const { oturum, girisGerekli, girisTuru, giris, cikis, veri, bagli, hata, simdi, tara, taraniyor, adimIsaretle, repoAc, loglar, logYukle, denetle, denetleniyor, bildirimDene } = useAtlas();
  const [secili, setSecili] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("hepsi");
  const [arama, setArama] = useState("");
  const [gorunum, setGorunum] = useState<"harita" | "liste">("harita");
  const [yakinlik, setYakinlik] = useState(100);
  const [paletAcik, setPaletAcik] = useState(false);
  const [duvar, setDuvar] = useState(() => window.location.hash === DUVAR_ADRESI);
  const azalt = useHareketAzalt();

  const vit = useMemo(() => (veri ? vitaller(veri) : null), [veri]);
  const vurgu = veri?.gorunum.vurgu ?? "#C4F56A";
  const { izin, izinIste } = useBildirim(veri?.olaylar, {
    dikkat: vit ? vit.dikkat.sorun + vit.dikkat.not : 0,
    genel: vit?.genel ?? "temiz",
    vurgu,
  });

  // Duvar modu adreste durur: /#duvar yer imi doğrudan açar.
  const duvarDegis = useCallback((ac: boolean) => {
    setDuvar(ac);
    history.replaceState(null, "", ac ? DUVAR_ADRESI : `${location.pathname}${location.search}`);
    if (!ac && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  const git = useCallback(
    (hash: string) => {
      const el = document.querySelector(hash);
      if (!el) return;
      history.replaceState(null, "", hash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      el.scrollIntoView({ behavior: azalt ? "auto" : "smooth", block: "start" });
    },
    [azalt],
  );

  useKisayollar({
    palet: () => setPaletAcik(true),
    tara: () => !taraniyor && tara(),
    duvar: () => duvarDegis(!duvar),
    gorunum: () => setGorunum((g) => (g === "harita" ? "liste" : "harita")),
    kacis: () => {
      if (paletAcik) setPaletAcik(false);
      else if (duvar && !document.fullscreenElement) duvarDegis(false);
      else if (filtre !== "hepsi" || arama) {
        setFiltre("hepsi");
        setArama("");
      }
    },
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--acc", vurgu);
  }, [vurgu]);

  if (oturum === "giris") return <Giris giris={giris} girisTuru={girisTuru} />;
  if (!veri || !vit) {
    return (
      <div className="yukleniyor" role="status">
        <span className="yukleniyor-radar" aria-hidden="true"><span /><RadarLogo boyut={44} /></span>
        <span className="mono">{hata ?? "Harita çiziliyor…"}</span>
      </div>
    );
  }

  const durumUyar = FILTRELER.find((f) => f.id === filtre)!.uyar;
  const sorgu = arama.trim().toLocaleLowerCase("tr-TR");
  const eslesir = (p: Proje) => durumUyar(p) && (!sorgu || `${p.ad} ${p.tur} ${p.aciklama ?? ""}`.toLocaleLowerCase("tr-TR").includes(sorgu));
  const varsayilan = veri.projeler.find((p) => p.ikon === "hub") ?? veri.projeler[0];
  const p = veri.projeler.find((x) => x.id === secili) ?? varsayilan;
  const senkron = Math.max(0, Math.round((simdi.getTime() - new Date(veri.zaman).getTime()) / 1000));
  const kok = { "--acc": vurgu } as CSSProperties;
  const sonucSayisi = veri.projeler.filter(eslesir).length;

  const vitalGit = (a: VitalAnahtar) => {
    if (a === "surecler") return git("#loglar");
    if (a === "adimlar") return git("#adimlar");
    if (a === "bekleyen") {
      const ilk = veri.projeler.find((x) => !x.kapsam?.length && (x.git?.bekleyen?.toplam ?? x.git?.geride ?? 0) > 0);
      if (ilk) {
        setSecili(ilk.id);
        return git("#detay");
      }
      return git("#harita");
    }
    if (a === "yerel") setGorunum("liste");
    if (a === "dikkat" || (a === "siteler" && vit.siteler.ayakta < vit.siteler.toplam)) setFiltre("dikkat");
    git("#harita");
  };

  const projeSec = (id: string) => {
    setSecili(id);
    if (!duvar) git("#detay");
  };

  const paletOgeleri: PaletOgesi[] = [
    { id: "e-tara", tur: "Eylem", ad: "Şimdi tara", alt: "önbellekleri atlayıp tüm kaynakları yeniden oku", kisayol: "R", ikon: <Svg ad="yenile" boyut={16} />, calistir: () => tara() },
    { id: "e-duvar", tur: "Eylem", ad: duvar ? "Duvar modundan çık" : "Duvar modu", alt: "televizyon / ikinci ekran için tek bakış", anahtar: "tv ekran tam", kisayol: "D", ikon: <Svg ad="ekran" boyut={16} />, calistir: () => duvarDegis(!duvar) },
    { id: "e-gorunum", tur: "Eylem", ad: gorunum === "harita" ? "Liste görünümüne geç" : "Harita görünümüne geç", anahtar: "tablo", kisayol: "L", ikon: <Svg ad={gorunum === "harita" ? "liste" : "harita"} boyut={16} />, calistir: () => setGorunum((g) => (g === "harita" ? "liste" : "harita")) },
    { id: "e-dikkat", tur: "Eylem", ad: "Yalnız dikkat bekleyenleri göster", anahtar: "süz filtre uyarı", ikon: <Svg ad="uyari" boyut={16} />, calistir: () => { setFiltre("dikkat"); git("#harita"); } },
    ...veri.projeler.map((x): PaletOgesi => ({
      id: `p-${x.id}`,
      tur: "Proje",
      ad: x.ad,
      alt: `${x.tur} · ${durumEtiketi(x)}${x.uyarilar.length ? ` · ${x.uyarilar.length} uyarı` : ""}`,
      anahtar: `${x.tur} ${x.aciklama ?? ""}`,
      st: x.durum,
      ikon: <ProjeIkon tur={x.ikon} boyut={16} />,
      calistir: () => projeSec(x.id),
    })),
    ...BOLUMLER.map((b): PaletOgesi => ({ id: `b-${b.hash}`, tur: "Bölüm", ad: b.ad, anahtar: b.anahtar, ikon: <Svg ad={b.ikon} boyut={16} />, calistir: () => { if (duvar) duvarDegis(false); requestAnimationFrame(() => git(b.hash)); } })),
    ...veri.projeler.filter((x) => x.url).map((x): PaletOgesi => ({
      id: `u-${x.id}`, tur: "Bağlantı", ad: `${x.url!.replace(/^https?:\/\//, "")} aç`, alt: x.ad, anahtar: x.ad, ikon: <Svg ad="dis" boyut={16} />,
      calistir: () => window.open(x.url, "_blank", "noopener,noreferrer"),
    })),
    { id: "e-denetle", tur: "Eylem", ad: "Kurulum denetimini çalıştır", anahtar: "doktor", ikon: <Svg ad="kalkan" boyut={16} />, calistir: () => { denetle(); if (!duvar) git("#denetim"); } },
    { id: "e-temizle", tur: "Eylem", ad: "Süzgeçleri temizle", anahtar: "filtre arama sıfırla", ikon: <Svg ad="kapat" boyut={16} />, calistir: () => { setFiltre("hepsi"); setArama(""); setYakinlik(100); } },
    ...(izin === "default" ? [{ id: "e-izin", tur: "Eylem" as const, ad: "Tarayıcı bildirimlerini aç", ikon: <Svg ad="zil" boyut={16} />, calistir: () => izinIste() }] : []),
    ...(veri.bildirimKanali?.telegram ? [{ id: "e-telegram", tur: "Eylem" as const, ad: "Telegram'a deneme mesajı", ikon: <Svg ad="zil" boyut={16} />, calistir: () => { bildirimDene(); } }] : []),
    ...(girisGerekli ? [{ id: "e-cikis", tur: "Eylem" as const, ad: "Çıkış yap", ikon: <Svg ad="dis" boyut={16} />, calistir: () => cikis() }] : []),
  ];

  const ortak = (
    <>
      <Tostlar olaylar={veri.olaylar} projeler={veri.projeler} sec={projeSec} />
      {paletAcik && <Palet ogeler={paletOgeleri} kapat={() => setPaletAcik(false)} />}
    </>
  );

  if (duvar) {
    return (
      <div style={kok}>
        <Duvar veri={veri} vit={vit} secili={p?.id ?? ""} sec={setSecili} simdi={simdi} bagli={bagli} kapat={() => duvarDegis(false)} />
        {ortak}
      </div>
    );
  }

  return (
    <div className={`uygulama durum-${vit.genel}`} style={kok}>
      <Kenar veri={veri} cikis={girisGerekli ? cikis : undefined} duvarAc={() => duvarDegis(true)} paletAc={() => setPaletAcik(true)} />
      <main className="ana">
        <header className="ust">
          <div className="ust-metin">
            <div className="kirinti"><span>Çalışma alanı</span><span className="ayrac">/</span><span>Proje haritası</span><span className="ortam-rozet">{veri.ortam === "sunucu" ? "SUNUCU" : "YEREL"}</span></div>
            <h1 className="manset">Her şey gözünün <span className="manset-vurgu">önünde.</span></h1>
            <button
              type="button"
              className={`durum-cumle durum-${vit.genel}`}
              title={vit.genel === "temiz" ? undefined : "Yalnız dikkat bekleyenleri göster"}
              onClick={() => { if (vit.genel !== "temiz") { setFiltre("dikkat"); git("#harita"); } }}
            >
              <span className="durum-isik" />
              <span>{durumCumlesi(vit)}</span>
              {vit.genel !== "temiz" && <Svg ad="ok" boyut={14} />}
            </button>
          </div>
          <div className="ust-sag">
            <div className="saat-blok" role="status" title={`Son veri ${senkron} saniye önce alındı`}>
              <time className="buyuk-saat mono" dateTime={simdi.toISOString()}>
                {simdi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}<span>:{String(simdi.getSeconds()).padStart(2, "0")}</span>
              </time>
              <span className="saat-alt">
                <TaramaHalkasi gecen={senkron} aralik={veri.yenilemeSaniye ?? 20} bagli={bagli} />
                <span className={`canli-yazi${bagli ? "" : " kopuk"}`}>{bagli ? "CANLI" : "BAĞLANTI YOK"}</span>
                <span className="sessiz">{simdi.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</span>
              </span>
            </div>
            <div className="ust-dugmeler">
              <button type="button" className="ibtn" title="Duvar modu (D)" aria-label="Duvar modu" onClick={() => duvarDegis(true)}><Svg ad="ekran" boyut={17} /></button>
              <button type="button" className="ibtn" title="Komut paleti (Ctrl K)" aria-label="Komut paleti" onClick={() => setPaletAcik(true)}><Svg ad="komut" boyut={16} /></button>
              <button type="button" className={`cta${taraniyor ? " tariyor" : ""}`} onClick={tara} disabled={taraniyor}><Svg ad="yenile" boyut={17} />{taraniyor ? "Taranıyor…" : "Şimdi tara"}</button>
            </div>
          </div>
        </header>

        {(hata || veri.manifestHatasi) && <div className="hata-serit" role="alert">{veri.manifestHatasi ?? hata}</div>}
        <ManifestSorunlari sorunlar={veri.manifestSorunlari} />
        <Vitaller veri={veri} vit={vit} git={vitalGit} />

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
                <span className="mono sessiz harita-sonuc" role="status">{sorgu || filtre !== "hepsi" ? `${sonucSayisi} / ${veri.projeler.length} eşleşme` : "fareyle üstüne gel · oklarla gez · Ctrl+tekerlek yakınlaştır"}</span>
              </div>
              {gorunum === "harita" ? <>
                <Harita veri={veri} secili={p?.id ?? ""} sec={setSecili} eslesir={eslesir} olcek={yakinlik / 100} radar={veri.gorunum.radar !== false} simdi={simdi} yakinlas={(f) => setYakinlik((z) => Math.max(60, Math.min(160, z + f)))} />
                <div className="harita-alt">
                  <div className="lejant"><span><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="1.2" /></svg>Modül bağı</span><span><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--acc)" strokeWidth="1.4" strokeDasharray="4 4" /></svg>Veri akışı</span><span className="st-live"><span className="dot" />Canlı</span><span className="st-dev"><span className="dot" />Geliştirmede</span><span className="st-warn"><span className="dot" />Dikkat</span><span className="lejant-nabiz"><i /><i /><i className="kismi" /><i />24 sa erişim</span></div>
                  <div className="yakinlik"><button type="button" className="ibtn" aria-label="Uzaklaştır" disabled={yakinlik <= 60} onClick={() => setYakinlik((z) => Math.max(60, z - 10))}><Svg ad="eksi" boyut={15} /></button><button type="button" className="yakinlik-sifirla mono" title="Haritayı ekrana sığdır" onClick={() => setYakinlik(100)}>{yakinlik}%</button><button type="button" className="ibtn" aria-label="Yakınlaştır" disabled={yakinlik >= 160} onClick={() => setYakinlik((z) => Math.min(160, z + 10))}><Svg ad="arti" boyut={15} /></button></div>
                </div>
              </> : <Liste veri={veri} sec={setSecili} eslesir={eslesir} simdi={simdi} />}
              {sonucSayisi === 0 && <p className="harita-bos" role="status">Bu süzgece uyan proje yok. <button type="button" onClick={() => { setFiltre("hepsi"); setArama(""); }}>Süzgeçleri temizle</button></p>}
            </section>
            <Olaylar veri={veri} simdi={simdi} sec={projeSec} izin={izin} izinIste={izinIste} bildirimDene={bildirimDene} />
            <Adimlar veri={veri} isaretle={adimIsaretle} />
            <YayinHatti veri={veri} sec={projeSec} />
            <Loglar veri={veri} loglar={loglar} logYukle={logYukle} />
            <Denetim denetim={veri.denetim} denetle={denetle} denetleniyor={denetleniyor} simdi={simdi} />
            <footer className="sayfa-alt"><span className={`canli-nokta${bagli ? "" : " kopuk"}`} /><span>{bagli ? "Canlı veriler bağlı" : "Yeniden bağlanılıyor"}</span>{veri.atlas?.commit && <span title={veri.atlas.mesaj ?? undefined}>· Atlas {veri.atlas.commit} · {goreli(veri.atlas.baslangic, simdi)} açıldı</span>}{veri.atlas?.derlemeEski && <span className="sayfa-alt-uyari">· arayüz eski derleme ({veri.atlas.derleme}) — scripts/guncelle.ps1</span>}<span className="sayfa-alt-zaman">Son senkron: {senkron} sn önce · <kbd>Ctrl K</kbd> komut paleti</span></footer>
          </div>
          {p ? <Detay veri={veri} p={p} simdi={simdi} sec={setSecili} repoAc={veri.ortam === "yerel" && !girisGerekli ? repoAc : undefined} /> : <aside className="panel detay"><p className="sessiz">İzlenecek projeler manifest eklendiğinde burada görünecek.</p></aside>}
        </div>
      </main>
      {ortak}
    </div>
  );
}
