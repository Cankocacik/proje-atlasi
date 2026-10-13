import { useState, type FormEvent } from "react";
import { RadarLogo } from "./Ikon";

export function Giris({ giris, girisTuru }: { giris: (parola: string) => Promise<void>; girisTuru: "portal" | "parola" }) {
  const [parola, setParola] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

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
      <form className="panel giris-kart" onSubmit={gonder}>
        <div className="marka" style={{ padding: 0 }}>
          <RadarLogo boyut={44} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="marka-ad">Proje Atlası</span>
            <span className="marka-alt">KOMUTA MERKEZİ</span>
          </div>
        </div>
        <label className="alan-etiket" htmlFor="parola">{girisTuru === "portal" ? "Rosbel portal parolan" : "Parola"}</label>
        <input
          id="parola"
          className="alan"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={parola}
          onChange={(e) => setParola(e.target.value)}
        />
        {hata && <div className="uyari-kutu" role="alert">{hata}</div>}
        <button type="submit" className="cta" disabled={!parola || bekliyor} style={{ justifyContent: "center" }}>
          {bekliyor ? "Kontrol ediliyor…" : "Giriş yap"}
        </button>
        <span className="mono sessiz" style={{ fontSize: 11 }}>Kişisel alan · yetkisiz erişim denemeleri kaydedilir</span>
      </form>
    </main>
  );
}
