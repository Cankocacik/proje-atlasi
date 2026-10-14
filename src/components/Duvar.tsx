import { useEffect, useState } from "react";
import type { Anlik, Proje } from "../types";
import { durumCumlesi, turdakiSonraki, turSirasi, type Vitaller as VitalTur } from "../lib/durumOzeti";
import { durumEtiketi } from "../lib/etiket";
import { olayZamani } from "../lib/olay";
import { goreli } from "../lib/zaman";
import { useHareketAzalt } from "../hooks/useEtkilesim";
import { Harita } from "./Harita";
import { ProjeIkon, RadarLogo, Svg } from "./Ikon";
import { Vitaller } from "./Vitaller";

const TUR_SN = 9;

interface Props {
  veri: Anlik;
  vit: VitalTur;
  secili: string;
  sec: (id: string) => void;
  simdi: Date;
  bagli: boolean;
  kapat: () => void;
}

/** Seçili düğümün büyük künyesi (haritanın köşesinde). Yalnız gerçek alanlar. */
function Spot({ p, simdi, ortam }: { p: Proje; simdi: Date; ortam: Anlik["ortam"] }) {
  const son = p.git?.son;
  const bekleyen = p.git?.bekleyen?.toplam ?? 0;
  return (
    <div key={p.id} className={`spot st-${p.durum}`} aria-live="polite">
      <div className="spot-ust">
        <span className="ico spot-ikon"><ProjeIkon tur={p.ikon} boyut={24} /></span>
        <span className="spot-baslik">
          <b>{p.ad}</b>
          <span className="pill"><span className="dot" />{durumEtiketi(p)}</span>
        </span>
      </div>
      <div className="spot-govde">
        {p.aciklama && <p className="spot-aciklama">{p.aciklama}</p>}
        <div className="spot-olcu mono">
          {p.saglik && <span>site <b>{p.saglik.ok ? `${p.saglik.ms} ms` : "yanıt yok"}</b></span>}
          {p.saglikGecmisi?.yuzde != null && <span>24 sa <b>%{p.saglikGecmisi.yuzde}</b></span>}
          {son && <span>son commit <b>{goreli(son.tarih, simdi)}</b></span>}
          {bekleyen > 0 && <span>{ortam === "sunucu" ? "canlıya bekleyen" : "çekilmemiş"} <b>{bekleyen}</b></span>}
        </div>
      </div>
      <div className="spot-uyarilar">
        {p.uyarilar.slice(0, 3).map((u) => (
          <div key={u.metin} className={`spot-uyari${u.seviye === "yuksek" ? " yuksek" : ""}`}><Svg ad="uyari" boyut={14} />{u.metin}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * Duvar modu: televizyon / ikinci ekran için tek bakış. Harita ekrana sığar, seçili düğüm büyük
 * künyede, sağda göstergeler ve olaylar, altta kayan olay şeridi. Otomatik tur düğümleri sırayla
 * gezer (sorunlular önce). Adres: /#duvar — yer imi olarak doğrudan açılır.
 */
export function Duvar({ veri, vit, secili, sec, simdi, bagli, kapat }: Props) {
  const azalt = useHareketAzalt();
  const [tur, setTur] = useState(!azalt);
  const [tamEkran, setTamEkran] = useState(() => Boolean(document.fullscreenElement));
  const sira = turSirasi(veri.projeler).join(",");

  useEffect(() => {
    const degisti = () => setTamEkran(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", degisti);
    return () => document.removeEventListener("fullscreenchange", degisti);
  }, []);

  useEffect(() => {
    if (!tur) return;
    const t = setTimeout(() => {
      const sonraki = turdakiSonraki(sira ? sira.split(",") : [], secili);
      if (sonraki) sec(sonraki);
    }, TUR_SN * 1000);
    return () => clearTimeout(t);
  }, [tur, sira, secili, sec]);

  const p = veri.projeler.find((x) => x.id === secili) ?? veri.projeler[0];
  const olaylar = (veri.olaylar ?? []).filter((o) => o.tur !== "atlas").slice(0, 14);
  const serit = olaylar.slice(0, 10);
  const byId = new Map(veri.projeler.map((x) => [x.id, x]));
  const tamEkranVar = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const tamEkranDegis = () => {
    if (!tamEkranVar) return;
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  };

  return (
    <div className={`duvar duvar-${vit.genel}`}>
      <header className="duvar-ust">
        <div className="duvar-marka">
          <RadarLogo boyut={34} />
          <span className="marka-ad">Proje Atlası</span>
        </div>
        <div className={`duvar-durum durum-${vit.genel}`}>
          <span className="durum-isik" />
          <span className="duvar-durum-baslik">{vit.genel === "sorun" ? "Dikkat gerekiyor" : vit.genel === "not" ? "Sistemler ayakta" : "Her şey yolunda"}</span>
          <span className="duvar-durum-cumle">{durumCumlesi(vit)}</span>
        </div>
        <div className="duvar-sag">
          <span className={`canli-yazi${bagli ? "" : " kopuk"}`}><span className={`canli-nokta${bagli ? " nabiz" : " kopuk"}`} /> {bagli ? "CANLI" : "BAĞLANTI YOK"}</span>
          <time className="duvar-saat mono">
            {simdi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            <span>{String(simdi.getSeconds()).padStart(2, "0")}</span>
          </time>
          <button type="button" className={`ibtn${tur ? " on" : ""}`} aria-pressed={tur} title={tur ? `Otomatik turu durdur (${TUR_SN} sn)` : "Otomatik tur: düğümleri sırayla gez"} aria-label="Otomatik tur" onClick={() => setTur((x) => !x)}>
            <Svg ad={tur ? "duraklat" : "oynat"} boyut={16} />
          </button>
          {tamEkranVar && (
            <button type="button" className="ibtn" title={tamEkran ? "Tam ekrandan çık" : "Tam ekran"} aria-label="Tam ekran" onClick={tamEkranDegis}>
              <Svg ad="tam" boyut={16} />
            </button>
          )}
          <button type="button" className="ibtn" title="Duvar modundan çık (Esc)" aria-label="Duvar modundan çık" onClick={kapat}>
            <Svg ad="kapat" boyut={16} />
          </button>
        </div>
      </header>

      <div className="duvar-govde">
        <section className="panel duvar-harita" aria-label="Proje haritası">
          <Harita veri={veri} secili={p?.id ?? ""} sec={(id) => { setTur(false); sec(id); }} eslesir={() => true} olcek={1} radar={veri.gorunum.radar !== false} simdi={simdi} sigdir />
          {p && <Spot p={p} simdi={simdi} ortam={veri.ortam} />}
          {tur && <span key={p?.id} className="tur-cubuk" style={{ ["--tur" as string]: `${TUR_SN}s` }} aria-hidden="true" />}
        </section>
        <aside className="duvar-yan">
          <Vitaller veri={veri} vit={vit} dikey />
          <section className="panel duvar-olaylar" aria-label="Son olaylar">
            <h2 className="panel-baslik">Son olaylar</h2>
            <ol>
              {olaylar.map((o) => (
                <li key={o.id} className={`olay-${o.seviye}`}>
                  <span className="olay-nokta" />
                  <span className="duvar-olay-metin">{o.metin}</span>
                  <time className="mono">{olayZamani(o.zaman, simdi)}</time>
                </li>
              ))}
              {!olaylar.length && <li className="sessiz">Henüz olay yok.</li>}
            </ol>
          </section>
        </aside>
      </div>

      <footer className="duvar-serit" aria-hidden="true">
        <div className={`serit-akis${azalt || serit.length < 2 ? " durgun" : ""}`}>
          {[0, 1].map((kopya) => (
            <span key={kopya} className="serit-grup">
              {serit.map((o) => (
                <span key={`${kopya}-${o.id}`} className={`serit-oge olay-${o.seviye}`}>
                  <span className="olay-nokta" />
                  <span className="mono">{olayZamani(o.zaman, simdi)}</span>
                  {o.projeId && byId.get(o.projeId) ? <b>{byId.get(o.projeId)!.ad}</b> : null}
                  {o.metin}
                </span>
              ))}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
