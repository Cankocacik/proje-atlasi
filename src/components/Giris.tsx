import { useState, type FormEvent } from "react";
import { RadarLogo, Svg } from "./Ikon";

export function Giris({ giris, girisTuru }: { giris: (parola: string) => Promise<void>; girisTuru: "portal" | "parola" }) {
  const [parola, setParola] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [goster, setGoster] = useState(false);

  const gonder = async (e: FormEvent) => {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    try {
      await giris(parola);
    } catch (err) {
      setHata((err as Error).message);
      setParola("");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <main className="giris-sayfa">
      {/* Dekor: arka planda dönen radar ve menzil halkaları. */}
      <div className="giris-radar" aria-hidden="true">
        <span className="giris-halka" style={{ ["--r" as string]: "28vmin" }} />
        <span className="giris-halka" style={{ ["--r" as string]: "52vmin" }} />
        <span className="giris-halka" style={{ ["--r" as string]: "78vmin" }} />
        <span className="giris-tarama" />
      </div>
      <form className={`panel giris-kart${hata ? " sarsil" : ""}`} onSubmit={gonder} key={hata ?? "temiz"}>
        <div className="marka" style={{ padding: 0 }}>
          <RadarLogo boyut={44} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="marka-isim">Proje Atlası</span>
            <span className="marka-alt">KOMUTA MERKEZİ</span>
          </div>
        </div>
        <p className="giris-aciklama">Projelerin, sunucun ve logların tek ekranda. Devam etmek için kimliğini doğrula.</p>
        <label className="alan-etiket" htmlFor="parola">{girisTuru === "portal" ? "Rosbel portal parolan" : "Parola"}</label>
        <div className="parola-alan">
          <input
            id="parola"
            className="alan"
            type={goster ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            value={parola}
            onChange={(e) => setParola(e.target.value)}
          />
          <button type="button" className="parola-goster" aria-pressed={goster} aria-label={goster ? "Parolayı gizle" : "Parolayı göster"} onClick={() => setGoster((x) => !x)}>
            {goster ? "gizle" : "göster"}
          </button>
        </div>
        {hata && <div className="uyari-kutu" role="alert"><Svg ad="uyari" boyut={16} />{hata}</div>}
        <button type="submit" className="cta" disabled={!parola || bekliyor} style={{ justifyContent: "center" }}>
          {bekliyor ? <><span className="donen" aria-hidden="true" />Kontrol ediliyor…</> : <>Giriş yap <Svg ad="ok" boyut={16} /></>}
        </button>
        <span className="mono sessiz giris-dip">
          <span className="canli-nokta nabiz" /> {window.location.host} · yetkisiz erişim denemeleri kaydedilir
        </span>
      </form>
    </main>
  );
}
