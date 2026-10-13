import { useState } from "react";
import type { Bekleyen as BekleyenTur, Ortam } from "../types";
import { goreli, tarihSaat } from "../lib/zaman";
import { kopyaParcalari, zincir } from "../lib/yayinKomutu";

interface Props {
  bekleyen: BekleyenTur;
  ortam: Ortam;
  simdi: Date;
}

/**
 * Sunucuda: canlıya alınmamış commitler + bunlardan çıkan yayın adımları (manifest `yayin.adimlar`).
 * PC'de: henüz çekilmemiş commitler.
 * Toplu kopya PowerShell zinciridir (bir adım bozulursa sonrakiler çalışmaz) ve karar noktasında
 * (`dur`, ör. migrate:verify) biter: çıktısı okunmadan devam edilmez.
 */
export function Bekleyen({ bekleyen, ortam, simdi }: Props) {
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const parcalar = kopyaParcalari(bekleyen.adimlar);
  const toplam = bekleyen.toplam ?? bekleyen.commitler.length;

  const kopyala = async (metin: string, anahtar: string) => {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalanan(anahtar);
      setTimeout(() => setKopyalanan((k) => (k === anahtar ? null : k)), 1500);
    } catch {
      // Pano izni yoksa sessizce geç; komut ekranda okunabilir.
    }
  };

  // Her komutun hangi parçada olduğu: karar noktasından sonra "sonra" parçası başlar.
  let parcaNo = 0;

  return (
    <div className="bekleyen">
      <div className="bekleyen-baslik">
        <span className="etiketcik">{ortam === "sunucu" ? "CANLIYA BEKLEYEN" : "ÇEKİLMEMİŞ"}</span>
        <span className="mono sessiz">{toplam} commit · {bekleyen.dosyaSayisi} dosya</span>
      </div>
      <ul className="bekleyen-commitler">
        {bekleyen.commitler.slice(0, 5).map((c) => (
          <li key={c.hash}>
            <span className="bekleyen-mesaj">{c.mesaj}</span>
            <span className="mono sessiz" title={tarihSaat(c.tarih)}>{c.kisa} · {goreli(c.tarih, simdi)}</span>
          </li>
        ))}
        {toplam > 5 && <li className="sessiz">+{toplam - 5} commit daha</li>}
      </ul>

      {bekleyen.adimlar.length > 0 && (
        <div className="yayin-adimlari">
          <div className="bekleyen-baslik">
            <span className="etiketcik">YAYIN ADIMLARI</span>
            {parcalar[0]?.length > 1 && (
              <button
                type="button"
                className="metin-dugme"
                title="Tek satır PowerShell: bir adım hata verirse sonrakiler çalışmaz"
                onClick={() => kopyala(zincir(parcalar[0]), "parca-0")}
              >
                {kopyalanan === "parca-0" ? "kopyalandı" : parcalar.length > 1 ? "karar noktasına kadar kopyala" : "tümünü kopyala"}
              </button>
            )}
          </div>
          <ol>
            {bekleyen.adimlar.map((a, i) => {
              const buParca = parcaNo;
              if (a.dur && !a.bilgi) parcaNo++;
              const sonrakiParca = parcalar[parcaNo];
              return (
                <li key={a.adim} className={a.bilgi ? "bilgi" : a.dur ? "dur" : undefined}>
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
                  {a.dur && !a.bilgi && buParca < parcalar.length - 1 && (
                    <div className="karar-noktasi" role="note">
                      <span>Karar noktası — çıktıyı oku, sonra devam et</span>
                      {sonrakiParca && sonrakiParca.length > 1 && (
                        <button type="button" className="metin-dugme" onClick={() => kopyala(zincir(sonrakiParca), `parca-${parcaNo}`)}>
                          {kopyalanan === `parca-${parcaNo}` ? "kopyalandı" : "kalanını kopyala"}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
