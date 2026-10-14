import { useEffect, useState } from "react";
import type { Anlik, Asama, ManifestSorunu, Proje } from "../types";
import { durumEtiketi } from "../lib/etiket";
import { goreli } from "../lib/zaman";
import { RadarLogo, Svg } from "./Ikon";

interface KenarProps {
  veri: Anlik;
  cikis?: () => void;
  duvarAc: () => void;
  paletAc: () => void;
}

export function Kenar({ veri, cikis, duvarAc, paletAc }: KenarProps) {
  const toplam = veri.hafta.reduce((t, g) => t + g.sayi, 0);
  const tepe = Math.max(1, ...veri.hafta.map((g) => g.sayi));
  const [konum, setKonum] = useState(() => window.location.hash || "#harita");
  useEffect(() => {
    const degisti = () => setKonum(window.location.hash || "#harita");
    window.addEventListener("hashchange", degisti);
    return () => window.removeEventListener("hashchange", degisti);
  }, []);
  // Rozet yalnız son 24 saatin hatalarını sayar: eski olay sonsuza dek kırmızı rozet bırakmasın.
  const gunOnce = Date.now() - 86_400_000;
  const olaySorun = (veri.olaylar ?? []).filter((o) => o.seviye === "hata" && Date.parse(o.zaman) >= gunOnce).length;
  const menu = [
    { href: "#ozet", ad: "Genel bakış", ikon: "ev" as const },
    { href: "#harita", ad: "Proje haritası", ikon: "harita" as const },
    { href: "#olaylar", ad: "Olay günlüğü", ikon: "zil" as const, rozet: olaySorun || undefined },
    { href: "#loglar", ad: "Sunucu & loglar", ikon: "kod" as const },
    { href: "#denetim", ad: "Kurulum denetimi", ikon: "kalkan" as const, rozet: veri.denetim?.ozet.hata || undefined },
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
      <button type="button" className="kenar-ara" onClick={paletAc}>
        <Svg ad="ara" boyut={15} /><span>Ara / komut</span><kbd>Ctrl K</kbd>
      </button>
      <nav className="menu" aria-label="Ana menü">
        <span className="menu-baslik">ÇALIŞMA ALANI</span>
        {menu.map((m) => (
          <a key={m.href} href={m.href} className={`nav${konum === m.href ? " on" : ""}`} aria-current={konum === m.href ? "location" : undefined}>
            <Svg ad={m.ikon} boyut={19} /><span className="nav-ad">{m.ad}</span>
            {m.rozet ? <span className="nav-rozet" aria-label={`${m.rozet} sorun`}>{m.rozet}</span> : null}
          </a>
        ))}
        <button type="button" className="nav nav-duvar" onClick={duvarAc} title="Televizyon / ikinci ekran için tek bakış (D)">
          <Svg ad="ekran" boyut={19} /><span className="nav-ad">Duvar modu</span><kbd>D</kbd>
        </button>
      </nav>
      <div className="kenar-alt">
        <div className="panel hafta">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="mono sessiz" style={{ fontSize: 11 }}>Son 7 gün</span>
            <span><b className="disp" style={{ fontSize: 18 }}>{toplam}</b> commit</span>
          </div>
          <div className="hafta-cubuklar">
            {veri.hafta.map((g, i) => (
              <div key={g.tarih} className="hafta-gun" title={`${g.tarih}: ${g.sayi} commit`}>
                <div
                  className={`hafta-cubuk${g.sayi ? (g.bugun ? " bugun" : " dolu") : ""}`}
                  style={{ height: g.sayi ? 8 + Math.round((g.sayi / tepe) * 44) : 4, ["--i" as string]: i }}
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

export function Liste({ veri, sec, eslesir, simdi }: { veri: Anlik; sec: (id: string) => void; eslesir: (p: Proje) => boolean; simdi: Date }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="liste">
        <thead>
          <tr><th>Düğüm</th><th>Tür</th><th>Durum</th><th>Site</th><th>24 sa</th><th>Sürüm</th><th>Son commit</th><th>Dikkat</th></tr>
        </thead>
        <tbody>
          {veri.projeler.filter(eslesir).map((p) => (
            <tr key={p.id} className={`st-${p.durum}`} onClick={() => sec(p.id)}>
              <td>
                <button type="button" className="liste-ad" onClick={() => sec(p.id)}>{p.ad}</button>
              </td>
              <td style={{ color: "var(--soluk)" }}>{p.tur}</td>
              <td><span className="pill"><span className="dot" style={{ width: 6, height: 6 }} />{durumEtiketi(p)}</span></td>
              <td className="mono" style={{ fontSize: 12 }}>{p.saglik ? (p.saglik.ok ? `${p.saglik.ms} ms` : <span className="metin-hata">{p.saglik.kod ?? p.saglik.hata}</span>) : "—"}</td>
              <td className="mono" style={{ fontSize: 12 }}>{p.saglikGecmisi?.yuzde != null ? `%${p.saglikGecmisi.yuzde}` : "—"}</td>
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
  const yuzde = veri.adimlar.length ? Math.round((tamam / veri.adimlar.length) * 100) : 0;
  return (
    <section id="adimlar" className="panel adimlar-panel" aria-label="Sıradaki adımlar">
      <div className="harita-ust">
        <div className="panel-baslik-grup">
          <h2 className="panel-baslik">Sıradaki adımlar</h2>
          <span className="panel-sayac">{veri.adimlar.length - tamam} açık</span>
        </div>
        <span className="adim-ozet mono">
          <span className="ilerleme-cubuk" style={{ width: 110 }}><span style={{ width: `${yuzde}%` }} /></span>
          {tamam} / {veri.adimlar.length} tamam
        </span>
      </div>
      <div className="adimlar-liste">
        <div>
          {sirali.map((a) => {
            const p = byId.get(a.projeId);
            const kimlik = `adim-${a.id.replace(/[^a-z0-9]/gi, "-")}`;
            return (
              <div key={a.id} className={`adim${a.tamam ? " tamam" : ""}${a.etiket === "engel" && !a.tamam ? " engel" : ""}`}>
                <input id={kimlik} type="checkbox" checked={a.tamam} onChange={(e) => isaretle(a.id, e.target.checked)} />
                <label htmlFor={kimlik} className="adim-metin" style={{ fontWeight: 500, fontSize: 14, cursor: "pointer" }}>{a.metin}</label>
                <span className={`adim-proje st-${p?.durum ?? "idle"}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--soluk)", minWidth: 0 }}>
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
    <section id="hat" className="panel yayin-panel" aria-label="Yayın hattı">
      <h2 className="panel-baslik">Yayın hattı</h2>
      <div className="yayin-seritler">
        {SERITLER.map((s, i) => {
          const ogeler = gorunur.filter((p) => s.asamalar.includes(p.asama));
          return (
            <div key={s.baslik} className={`yayin-asama st-${s.st}`}>
              <div className="yayin-asama-baslik">
                <span className="yayin-sira mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="dot" />
                <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase" }}>{s.baslik}</span>
                <span className="mono sessiz" style={{ marginLeft: "auto", fontSize: 11.5 }}>{ogeler.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ogeler.map((p) => (
                  <button key={p.id} type="button" className={`hat-oge st-${p.durum}`} onClick={() => sec(p.id)}>
                    <span className="dot" />{p.ad}
                  </button>
                ))}
                {!ogeler.length && <span className="sessiz" style={{ fontSize: 12.5 }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** projeler.json elle düzenlenir; yazım hatası ekranın üstünde açıkça görünür (kaydedince kaybolur). */
export function ManifestSorunlari({ sorunlar }: { sorunlar: ManifestSorunu[] | undefined }) {
  if (!sorunlar?.length) return null;
  const hata = sorunlar.filter((s) => s.seviye === "hata").length;
  return (
    <details className={`manifest-serit${hata ? " hata" : ""}`} open={hata > 0}>
      <summary>
        <Svg ad="uyari" boyut={15} />
        <span>projeler.json: {hata ? `${hata} hata` : ""}{hata && sorunlar.length > hata ? " · " : ""}{sorunlar.length > hata ? `${sorunlar.length - hata} uyarı` : ""}</span>
        <span className="sessiz mono">dosyayı kaydedince ekran yenilenir</span>
      </summary>
      <ul>
        {sorunlar.map((s, i) => (
          <li key={i}><span className="mono">{s.yer}</span> {s.mesaj}</li>
        ))}
      </ul>
    </details>
  );
}
