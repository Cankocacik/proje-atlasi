import { useState } from "react";
import type { Denetim as DenetimTur } from "../types";
import { goreli } from "../lib/zaman";
import { Svg } from "./Ikon";

interface Props {
  denetim: DenetimTur | null | undefined;
  denetle: () => void;
  denetleniyor: boolean;
  simdi: Date;
}

const ISARET = { ok: "✓", uyari: "!", hata: "✗", atla: "·" } as const;

export function Denetim({ denetim, denetle, denetleniyor, simdi }: Props) {
  const sorunVar = Boolean(denetim && (denetim.ozet.hata || denetim.ozet.uyari));
  const [acik, setAcik] = useState(false);
  const gorunen = !denetim ? [] : acik || !sorunVar ? denetim.sonuclar : denetim.sonuclar.filter((s) => s.durum === "hata" || s.durum === "uyari");

  return (
    <section id="denetim" className="panel denetim-panel" aria-label="Kurulum denetimi">
      <div className="harita-ust">
        <div className="panel-baslik-grup">
          <h2 className="panel-baslik">Kurulum denetimi</h2>
          {denetim && (
            <span className={`pill ${denetim.ozet.hata ? "st-warn" : denetim.ozet.uyari ? "st-dev" : "st-live"}`}>
              {denetim.ozet.hata ? `${denetim.ozet.hata} hata` : denetim.ozet.uyari ? `${denetim.ozet.uyari} uyarı` : "temiz"}
            </span>
          )}
        </div>
        <div className="harita-araclar">
          {denetim && <span className="mono sessiz" style={{ fontSize: 11 }}>{goreli(denetim.zaman, simdi)}</span>}
          <button type="button" className="fbtn" onClick={denetle} disabled={denetleniyor}>
            <Svg ad="yenile" boyut={14} />{denetleniyor ? "Denetleniyor…" : "Şimdi denetle"}
          </button>
        </div>
      </div>
      {!denetim ? (
        <p className="olay-bos sessiz">İlk denetim sürüyor…</p>
      ) : (
        <>
          {!sorunVar && !acik ? (
            <p className="olay-bos sessiz">
              {denetim.ozet.ok} kontrol geçti
              {denetim.ozet.atla ? `, ${denetim.ozet.atla} kontrol bu ortamda yapılmadı` : ""}.{" "}
              <button type="button" className="metin-dugme" onClick={() => setAcik(true)}>Ayrıntılar</button>
            </p>
          ) : (
            <ul className="denetim-listesi">
              {gorunen.map((s) => (
                <li key={s.ad} className={`denetim-satir denetim-${s.durum}`}>
                  <span className="denetim-isaret mono" aria-label={s.durum}>{ISARET[s.durum]}</span>
                  <span className="denetim-ad">{s.ad}</span>
                  <span className="denetim-mesaj">{s.mesaj}</span>
                  {s.cozum && (s.durum === "hata" || s.durum === "uyari") && <span className="denetim-cozum mono">→ {s.cozum}</span>}
                </li>
              ))}
            </ul>
          )}
          {sorunVar && (
            <p className="olay-bos sessiz" style={{ paddingTop: 0 }}>
              <button type="button" className="metin-dugme" onClick={() => setAcik((x) => !x)}>
                {acik ? "Yalnız sorunları göster" : `Tüm kontrolleri göster (${denetim.sonuclar.length})`}
              </button>
            </p>
          )}
        </>
      )}
    </section>
  );
}
