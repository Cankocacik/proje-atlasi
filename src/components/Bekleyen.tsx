import { useState } from "react";
import type { Bekleyen as BekleyenTur, Ortam } from "../types";
import { goreli, tarihSaat } from "../lib/zaman";

interface Props {
  bekleyen: BekleyenTur;
  ortam: Ortam;
  simdi: Date;
}

/**
 * Sunucuda: canlıya alınmamış commitler + bunlardan çıkan yayın adımları (manifest `yayin.adimlar`).
 * PC'de: henüz çekilmemiş commitler.
 */
export function Bekleyen({ bekleyen, ortam, simdi }: Props) {
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const komutlar = bekleyen.adimlar.filter((a) => !a.bilgi);

  const kopyala = async (metin: string, anahtar: string) => {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalanan(anahtar);
      setTimeout(() => setKopyalanan((k) => (k === anahtar ? null : k)), 1500);
    } catch {
      // Pano izni yoksa sessizce geç; komut ekranda okunabilir.
    }
  };

  return (
    <div className="bekleyen">
      <div className="bekleyen-baslik">
        <span className="etiketcik">{ortam === "sunucu" ? "CANLIYA BEKLEYEN" : "ÇEKİLMEMİŞ"}</span>
        <span className="mono sessiz">{bekleyen.commitler.length} commit · {bekleyen.dosyaSayisi} dosya</span>
      </div>
      <ul className="bekleyen-commitler">
        {bekleyen.commitler.slice(0, 5).map((c) => (
          <li key={c.hash}>
            <span className="bekleyen-mesaj">{c.mesaj}</span>
            <span className="mono sessiz" title={tarihSaat(c.tarih)}>{c.kisa} · {goreli(c.tarih, simdi)}</span>
          </li>
        ))}
        {bekleyen.commitler.length > 5 && <li className="sessiz">+{bekleyen.commitler.length - 5} commit daha</li>}
      </ul>

      {bekleyen.adimlar.length > 0 && (
        <div className="yayin-adimlari">
          <div className="bekleyen-baslik">
            <span className="etiketcik">YAYIN ADIMLARI</span>
            {komutlar.length > 1 && (
              <button type="button" className="metin-dugme" onClick={() => kopyala(komutlar.map((a) => a.adim).join("\n"), "hepsi")}>
                {kopyalanan === "hepsi" ? "kopyalandı" : "tümünü kopyala"}
              </button>
            )}
          </div>
          <ol>
            {bekleyen.adimlar.map((a, i) => (
              <li key={a.adim} className={a.bilgi ? "bilgi" : undefined}>
                <div className="yayin-adim-satir">
                  {a.bilgi ? <span className="yayin-adim-bilgi">{a.adim}</span> : <code>{a.adim}</code>}
                  {!a.bilgi && (
                    <button type="button" className="kopyala" aria-label={`${i + 1}. adımı kopyala`} onClick={() => kopyala(a.adim, a.adim)}>
                      {kopyalanan === a.adim ? "✓" : "kopyala"}
                    </button>
                  )}
                </div>
                <span className="sessiz yayin-adim-alt" title={a.ornek.join("\n")}>
                  {a.dosya} dosya{a.not ? ` · ${a.not}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
