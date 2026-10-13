import { useEffect, useMemo, useRef, useState } from "react";
import type { Anlik, LogSatiri, Surec } from "../types";
import { Svg } from "./Ikon";
import { hataOzeti } from "../lib/hataOzeti";

/** İmzanın ilk değişken yerine kadarki kısmı: aramada aynı hatanın tüm tekrarlarını yakalar. */
const aramaParcasi = (imza: string, ornek: string) => (imza.split("‹")[0].trim() || ornek).slice(0, 60);

/** Görünen satırları (süzgeçler uygulanmış) düz metin .log olarak indirir. */
function indir(surec: string, satirlar: LogSatiri[]) {
  const metin = satirlar.map((s) => `${s.gecmis ? "-" : s.zaman}\t${s.akim}\t${s.metin}`).join("\n");
  const url = URL.createObjectURL(new Blob([metin], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${surec}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.log`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  veri: Anlik;
  loglar: Record<string, LogSatiri[]>;
  logYukle: (surec: string) => void;
}

function sureMetni(sn: number) {
  if (sn < 60) return `${sn} sn`;
  if (sn < 3600) return `${Math.floor(sn / 60)} dk`;
  if (sn < 86400) return `${Math.floor(sn / 3600)} sa`;
  return `${Math.floor(sn / 86400)} gün`;
}

// Paletteki mavi "geliştirmede" demek; sorunlu süreç (durmuş, hata yağan, yeniden başlayan) turuncu.
const surecDurumu = (s: Surec) =>
  s.durum !== "online" || s.hata15 >= 10 || s.sonSaatYenidenBaslama > 0 ? "warn" : "live";

export function Loglar({ veri, loglar, logYukle }: Props) {
  const surecler = veri.surecler;
  const [secili, setSecili] = useState<string | null>(null);
  const [yalnizHata, setYalnizHata] = useState(false);
  const [arama, setArama] = useState("");
  const [takip, setTakip] = useState(true);
  const kutu = useRef<HTMLDivElement>(null);

  const aktif = secili ?? surecler?.[0]?.ad ?? null;

  useEffect(() => {
    if (aktif && !loglar[aktif]) logYukle(aktif);
  }, [aktif]); // eslint-disable-line react-hooks/exhaustive-deps

  const sikHatalar = useMemo(() => hataOzeti((aktif && loglar[aktif]) || [], 3), [aktif, loglar]);

  const satirlar = useMemo(() => {
    const kaynak = (aktif && loglar[aktif]) || [];
    const q = arama.trim().toLocaleLowerCase("tr");
    return kaynak.filter((s) => (!yalnizHata || s.hata) && (!q || s.metin.toLocaleLowerCase("tr").includes(q)));
  }, [aktif, loglar, yalnizHata, arama]);

  useEffect(() => {
    if (takip && kutu.current) kutu.current.scrollTop = kutu.current.scrollHeight;
  }, [satirlar.length, takip]);

  return (
    <section id="loglar" className="panel" aria-label="Sunucu ve loglar" style={{ overflow: "hidden" }}>
      <div className="harita-ust">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 className="panel-baslik">Sunucu &amp; loglar</h2>
          <span className="mono sessiz" style={{ fontSize: 11.5 }}>pm2 · canlı kuyruk</span>
        </div>
        {surecler && <span className="mono sessiz" style={{ fontSize: 11.5 }}>{surecler.filter((s) => s.durum === "online").length}/{surecler.length} çalışıyor</span>}
      </div>

      {!surecler ? (
        <p className="sessiz" style={{ margin: 0, padding: "18px", fontSize: 13.5 }}>
          Bu makinede pm2 yok. Panel, Atlas sunucuda çalışırken siparis-backend ve Mutabiko süreçleriyle dolar.
        </p>
      ) : (
        <>
          <div className="surec-serit" role="group" aria-label="Süreç seç">
            {surecler.map((s) => (
              <button
                key={s.ad}
                type="button"
                className={`surec st-${surecDurumu(s)}${s.ad === aktif ? " on" : ""}`}
                aria-pressed={s.ad === aktif}
                onClick={() => setSecili(s.ad)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`dot${s.durum === "online" ? "" : " nabiz"}`} />
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: "#fff" }}>{s.ad}</span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--soluk)" }}>
                  {s.durum === "online" ? `↑ ${sureMetni(s.calismaSn)}` : s.durum} · ↻ {s.yenidenBaslama}
                  {s.bellekMb != null ? ` · ${s.bellekMb} MB` : ""}
                  {s.cpu != null ? ` · %${s.cpu}` : ""}
                </span>
                {s.hata15 > 0 && <span className="mono" style={{ fontSize: 11, color: "var(--warn)" }}>{s.hata15} hata / 15 dk</span>}
              </button>
            ))}
          </div>

          <div className="log-arac">
            <label className="gizli" htmlFor="log-ara">Logda ara</label>
            <input id="log-ara" className="alan" style={{ flex: "1 1 220px", minHeight: 36 }} placeholder="Logda ara…" value={arama} onChange={(e) => setArama(e.target.value)} />
            <button type="button" className={`fbtn${yalnizHata ? " on" : ""}`} aria-pressed={yalnizHata} onClick={() => setYalnizHata((x) => !x)}>Yalnız hatalar</button>
            <button type="button" className={`fbtn${takip ? " on" : ""}`} aria-pressed={takip} onClick={() => setTakip((x) => !x)}>Takip et</button>
            <span className="mono sessiz" style={{ fontSize: 11 }}>{satirlar.length} satır</span>
            <button type="button" className="fbtn" disabled={!satirlar.length} onClick={() => aktif && indir(aktif, satirlar)} title="Ekrandaki satırları .log dosyası olarak indir">
              <Svg ad="indir" boyut={14} />İndir
            </button>
          </div>

          {sikHatalar.length > 0 && (
            <div className="sik-hatalar" aria-label="Sık hatalar">
              <span className="etiketcik">SIK HATALAR</span>
              {sikHatalar.map((g) => (
                <button
                  key={g.imza}
                  type="button"
                  className="sik-hata"
                  title={`Örnek: ${g.ornek}\nTıkla: logda bu hatayı süz`}
                  onClick={() => {
                    setYalnizHata(true);
                    setArama(aramaParcasi(g.imza, g.ornek));
                  }}
                >
                  <span className="mono sik-hata-sayi">×{g.sayi}</span>
                  <span className="sik-hata-metin">{g.imza}</span>
                  {g.son && <span className="mono sessiz">{new Date(g.son).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>}
                </button>
              ))}
            </div>
          )}

          <div ref={kutu} className="log-kutu" role="log" aria-live="off" onScroll={(e) => {
            const el = e.currentTarget;
            const altta = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            if (takip !== altta) setTakip(altta);
          }}>
            {satirlar.map((s, i) => (
              <div key={i} className={`log-satir${s.hata ? " hata" : ""}`}>
                <span className="log-zaman" title={s.gecmis ? "Atlas açılmadan önce yazılmış satır (zamanı bilinmiyor)" : new Date(s.zaman).toLocaleString("tr-TR")}>
                  {s.gecmis ? "önce" : new Date(s.zaman).toLocaleTimeString("tr-TR")}
                </span>
                <span className="log-akim">{s.akim}</span>
                <span className="log-metin">{s.metin}</span>
              </div>
            ))}
            {!satirlar.length && <div className="sessiz" style={{ padding: 12 }}>{arama || yalnizHata ? "Süzgece uyan satır yok." : "Log boş."}</div>}
          </div>
        </>
      )}
    </section>
  );
}
