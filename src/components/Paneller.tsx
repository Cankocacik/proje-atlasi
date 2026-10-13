import type { Anlik, Asama, Proje } from "../types";
import { durumEtiketi } from "../lib/etiket";
import { goreli } from "../lib/zaman";
import { RadarLogo, Svg } from "./Ikon";

export function Kenar({ veri, cikis }: { veri: Anlik; cikis?: () => void }) {
  const toplam = veri.hafta.reduce((t, g) => t + g.sayi, 0);
  const tepe = Math.max(1, ...veri.hafta.map((g) => g.sayi));
  const menu = [
    { href: "#ozet", ad: "Genel bakış", ikon: "ev" as const },
    { href: "#harita", ad: "Proje haritası", ikon: "harita" as const, on: true },
    { href: "#loglar", ad: "Sunucu & loglar", ikon: "kod" as const },
    { href: "#adimlar", ad: "Sıradaki adımlar", ikon: "liste" as const },
    { href: "#hat", ad: "Yayın hattı", ikon: "hat" as const },
    { href: "#aktivite", ad: "Son commitler", ikon: "nabiz" as const },
  ];
  return (
    <aside className="kenar">
      <div className="marka">
        <RadarLogo />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="marka-ad">Proje Atlası</span>
          <span className="marka-alt">KOMUTA MERKEZİ</span>
        </div>
      </div>
      <nav className="menu" aria-label="Ana menü">
        <span className="menu-baslik">ÇALIŞMA ALANI</span>
        {menu.map((m) => (
          <a key={m.href} href={m.href} className={`nav${m.on ? " on" : ""}`} aria-current={m.on ? "page" : undefined}>
            <Svg ad={m.ikon} boyut={19} />{m.ad}
          </a>
        ))}
      </nav>
      <div className="kenar-alt">
        <div className="panel hafta">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="mono sessiz" style={{ fontSize: 11 }}>Son 7 gün</span>
            <span><b className="disp" style={{ fontSize: 18 }}>{toplam}</b> commit</span>
          </div>
          <div className="hafta-cubuklar">
            {veri.hafta.map((g) => (
              <div key={g.tarih} className="hafta-gun" title={`${g.tarih}: ${g.sayi} commit`}>
                <div
                  className={`hafta-cubuk${g.sayi ? (g.bugun ? " bugun" : " dolu") : ""}`}
                  style={{ height: g.sayi ? 8 + Math.round((g.sayi / tepe) * 44) : 4 }}
                />
                <span className="hafta-etiket">{g.gun}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="kisi">
          <span className="avatar">MK</span>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>Kişisel alan</span>
            <span className="mono sessiz" style={{ fontSize: 11 }}>{veri.ortam === "sunucu" ? "parolalı erişim" : "yalnız bu bilgisayar"}</span>
          </span>
          {cikis && (
            <button type="button" className="ibtn" style={{ marginLeft: "auto", width: 40, height: 40 }} aria-label="Çıkış yap" title="Çıkış yap" onClick={cikis}>
              <Svg ad="dis" boyut={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function OzetSeridi({ veri }: { veri: Anlik }) {
  const P = veri.projeler;
  const say = (fn: (p: Proje) => boolean) => P.filter(fn).length;
  const kart = say((p) => Boolean(p.kart));
  const ogeler = [
    { ad: "Toplam düğüm", deger: P.length, alt: `${kart} proje + ${P.length - kart} alt`, st: "idle" },
    { ad: "Canlıda", deger: say((p) => p.asama === "canli"), alt: `/ ${P.length}`, st: "live" },
    { ad: "Geliştirmede", deger: say((p) => p.asama === "gelistirme"), alt: `/ ${P.length}`, st: "dev" },
    { ad: "Dikkat bekleyen", deger: say((p) => p.uyarilar.length > 0), alt: `/ ${P.length}`, st: "warn" },
  ];
  return (
    <section id="ozet" className="panel kpi-serit" aria-label="Özet göstergeler">
      {ogeler.map((o) => (
        <div key={o.ad} className={`kpi st-${o.st}`}>
          <span className="ico" style={{ width: 42, height: 42 }}><span className="dot" /></span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
            <span className="kpi-ad" style={{ fontSize: 12.5, color: "var(--soluk)" }}>{o.ad}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
              <span className="kpi-sayi">{o.deger}</span>
              <span className="mono sessiz kpi-alt" style={{ fontSize: 12 }}>{o.alt}</span>
            </div>
          </div>
          <div className="tikler" aria-hidden="true">
            {P.map((p, i) => <span key={p.id} className={`tik${i < o.deger ? " on" : ""}`} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

export function Liste({ veri, sec, eslesir, simdi }: { veri: Anlik; sec: (id: string) => void; eslesir: (p: Proje) => boolean; simdi: Date }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="liste">
        <thead>
          <tr><th>Düğüm</th><th>Tür</th><th>Durum</th><th>Sürüm</th><th>Son commit</th><th>Dikkat</th></tr>
        </thead>
        <tbody>
          {veri.projeler.filter(eslesir).map((p) => (
            <tr key={p.id} className={`st-${p.durum}`} onClick={() => sec(p.id)}>
              <td>
                <button type="button" onClick={() => sec(p.id)} style={{ background: "none", border: 0, padding: 0, color: "#fff", fontWeight: 600, cursor: "pointer" }}>{p.ad}</button>
              </td>
              <td style={{ color: "var(--soluk)" }}>{p.tur}</td>
              <td><span className="pill"><span className="dot" style={{ width: 6, height: 6 }} />{durumEtiketi(p)}</span></td>
              <td className="mono" style={{ fontSize: 12 }}>{p.surum ?? p.git?.son?.kisa ?? "—"}</td>
              <td className="mono" style={{ fontSize: 12 }}>{p.git?.son ? goreli(p.git.son.tarih, simdi) : "—"}</td>
              <td style={{ color: "var(--yazi-2)" }}>{p.uyarilar.map((u) => u.metin).join(" · ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Adimlar({ veri, isaretle }: { veri: Anlik; isaretle: (id: string, tamam: boolean) => void }) {
  const byId = new Map(veri.projeler.map((p) => [p.id, p]));
  const sirali = [...veri.adimlar].sort(
    (a, b) => Number(a.tamam) - Number(b.tamam) || Number(b.etiket === "engel") - Number(a.etiket === "engel"),
  );
  const tamam = veri.adimlar.filter((a) => a.tamam).length;
  return (
    <section id="adimlar" className="panel" aria-label="Sıradaki adımlar" style={{ flex: "999 1 460px", minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px" }}>
        <h2 className="panel-baslik">Sıradaki adımlar</h2>
        <span className="mono sessiz" style={{ fontSize: 12 }}>{tamam} / {veri.adimlar.length} tamam</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 520 }}>
          {sirali.map((a) => {
            const p = byId.get(a.projeId);
            const kimlik = `adim-${a.id.replace(/[^a-z0-9]/gi, "-")}`;
            return (
              <div key={a.id} className={`adim${a.tamam ? " tamam" : ""}`}>
                <input id={kimlik} type="checkbox" checked={a.tamam} onChange={(e) => isaretle(a.id, e.target.checked)} />
                <label htmlFor={kimlik} className="adim-metin" style={{ fontWeight: 500, fontSize: 14, cursor: "pointer" }}>{a.metin}</label>
                <span className={`st-${p?.durum ?? "idle"}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--soluk)", minWidth: 0 }}>
                  <span className="dot" />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p?.ad ?? a.projeId}</span>
                </span>
                <span className={a.etiket === "engel" ? "st-warn" : "st-idle"} style={{ justifySelf: "end" }}>
                  <span className="pill">{a.etiket === "engel" ? "Engel" : "Sırada"}</span>
                </span>
              </div>
            );
          })}
          {!sirali.length && <p className="sessiz" style={{ padding: "0 18px 18px" }}>projeler.json'da adım yok.</p>}
        </div>
      </div>
    </section>
  );
}

const SERITLER: { baslik: string; asamalar: Asama[]; st: string }[] = [
  { baslik: "Fikir / beklemede", asamalar: ["fikir", "beklemede"], st: "idle" },
  { baslik: "Geliştirmede", asamalar: ["gelistirme"], st: "dev" },
  { baslik: "Canlıya bekliyor", asamalar: ["bekliyor"], st: "warn" },
  { baslik: "Canlı", asamalar: ["canli"], st: "live" },
];

export function YayinHatti({ veri, sec }: { veri: Anlik; sec: (id: string) => void }) {
  // Canlıdaki modüller kalabalık yapmasın: canlı şeridinde yalnız ana projeler.
  const gorunur = veri.projeler.filter((p) => p.kart || p.asama !== "canli");
  return (
    <section id="hat" className="panel" aria-label="Yayın hattı" style={{ flex: "1 1 280px", minWidth: 0, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="panel-baslik">Yayın hattı</h2>
      {SERITLER.map((s) => {
        const ogeler = gorunur.filter((p) => s.asamalar.includes(p.asama));
        return (
          <div key={s.baslik} className={`st-${s.st}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot" />
              <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase" }}>{s.baslik}</span>
              <span className="mono sessiz" style={{ marginLeft: "auto", fontSize: 11.5 }}>{ogeler.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ogeler.map((p) => (
                <button key={p.id} type="button" className="hat-oge" style={{ cursor: "pointer" }} onClick={() => sec(p.id)}>{p.ad}</button>
              ))}
              {!ogeler.length && <span className="sessiz" style={{ fontSize: 12.5 }}>—</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
