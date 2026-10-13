import { useState } from "react";
import type { Anlik, Olay } from "../types";
import { olayZamani } from "../lib/olay";

interface Props {
  veri: Anlik;
  simdi: Date;
  sec: (id: string) => void;
  izin: NotificationPermission | "yok";
  izinIste: () => void;
}

const TUR_AD: Record<string, string> = {
  site: "site",
  surec: "pm2",
  commit: "commit",
  yayin: "yayın",
  denetim: "kurulum",
  atlas: "atlas",
  icsaglik: "iç sağlık",
};

const sorunMu = (o: Olay) => o.seviye === "hata" || o.seviye === "uyari";

export function Olaylar({ veri, simdi, sec, izin, izinIste }: Props) {
  const [yalnizSorun, setYalnizSorun] = useState(false);
  const byId = new Map(veri.projeler.map((p) => [p.id, p]));
  const tumu = veri.olaylar ?? [];
  const liste = yalnizSorun ? tumu.filter(sorunMu) : tumu;

  return (
    <section id="olaylar" className="panel olay-panel" aria-label="Olay günlüğü">
      <div className="harita-ust">
        <div className="panel-baslik-grup">
          <h2 className="panel-baslik">Olay günlüğü</h2>
          <span className="panel-sayac">{tumu.length}</span>
        </div>
        <div className="harita-araclar">
          {izin === "default" && (
            <button type="button" className="fbtn" onClick={izinIste} title="Sekme arka plandayken site düşerse ya da süreç durursa bildirim gelsin">
              Bildirimleri aç
            </button>
          )}
          {izin === "granted" && <span className="mono sessiz olay-izin">bildirim açık</span>}
          <div className="seg" role="group" aria-label="Olayları süz">
            <button type="button" className={`seg-btn${!yalnizSorun ? " on" : ""}`} aria-pressed={!yalnizSorun} onClick={() => setYalnizSorun(false)}>Tümü</button>
            <button type="button" className={`seg-btn${yalnizSorun ? " on" : ""}`} aria-pressed={yalnizSorun} onClick={() => setYalnizSorun(true)}>Sorunlar</button>
          </div>
        </div>
      </div>
      {liste.length ? (
        <ol className="olay-listesi">
          {liste.map((o) => {
            const p = o.projeId ? byId.get(o.projeId) : undefined;
            return (
              <li key={o.id} className={`olay olay-${o.seviye}`}>
                <time className="mono olay-zaman" dateTime={o.zaman} title={new Date(o.zaman).toLocaleString("tr-TR")}>{olayZamani(o.zaman, simdi)}</time>
                <span className="olay-nokta" aria-hidden="true" />
                <span className="olay-metin">{o.metin}</span>
                <span className="olay-son">
                  <span className="mono olay-tur">{TUR_AD[o.tur] ?? o.tur}</span>
                  {p && <button type="button" className="olay-proje" onClick={() => sec(p.id)}>{p.ad}</button>}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="olay-bos sessiz">
          {yalnizSorun ? "Kayıtlı sorun yok." : "Henüz olay yok. Site düşmesi, süreç durması, yeni commit ve canlıya alma burada birikir."}
        </p>
      )}
    </section>
  );
}
