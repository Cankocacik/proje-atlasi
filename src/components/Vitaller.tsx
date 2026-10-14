import type { Anlik } from "../types";
import type { Vitaller as VitalTur } from "../lib/durumOzeti";
import { useSayac } from "../hooks/useEtkilesim";
import { Svg } from "./Ikon";

export type VitalAnahtar = "siteler" | "surecler" | "yerel" | "bekleyen" | "dikkat" | "adimlar";

interface Karo {
  anahtar: VitalAnahtar;
  ad: string;
  deger: number;
  birim?: string;
  alt: string;
  /** Halkanın doluluğu; kaynağı yoksa null (halka boş çizilir). */
  oran: number | null;
  st: "live" | "dev" | "warn" | "hata" | "idle";
  ikon: Parameters<typeof Svg>[0]["ad"];
  ipucu: string;
}

function karolar(veri: Anlik, v: VitalTur): Karo[] {
  const sunucu = veri.ortam === "sunucu";
  const k: Karo[] = [
    {
      anahtar: "siteler",
      ad: "Siteler",
      deger: v.siteler.ayakta,
      birim: `/${v.siteler.toplam}`,
      alt: v.siteler.toplam ? (v.siteler.ortMs != null ? `ort. ${v.siteler.ortMs} ms` : "yanıt yok") : "izlenen site yok",
      oran: v.siteler.toplam ? v.siteler.ayakta / v.siteler.toplam : null,
      st: !v.siteler.toplam ? "idle" : v.siteler.ayakta === v.siteler.toplam ? "live" : "hata",
      ikon: "kure",
      ipucu: "Dakikada bir yoklanan sitelerden yanıt verenler",
    },
    v.surecler
      ? {
          anahtar: "surecler",
          ad: "pm2 süreçleri",
          deger: v.surecler.calisan,
          birim: `/${v.surecler.toplam}`,
          alt: v.surecler.yenidenBaslama ? `${v.surecler.yenidenBaslama} yeniden başlama / sa` : "son saatte kesinti yok",
          oran: v.surecler.toplam ? v.surecler.calisan / v.surecler.toplam : null,
          st: v.surecler.calisan < v.surecler.toplam ? "hata" : v.surecler.yenidenBaslama ? "warn" : "live",
          ikon: "sunucu",
          ipucu: "Sunucudaki pm2 süreçleri — tıkla: loglar",
        }
      : {
          anahtar: "yerel",
          ad: "Yerel değişiklik",
          deger: v.repolar.yerelDegisen,
          birim: " dosya",
          alt: v.repolar.yerelIleride ? `${v.repolar.yerelIleride} commit push bekliyor` : "push bekleyen yok",
          oran: v.repolar.toplam ? (v.repolar.toplam - v.repolar.kirli) / v.repolar.toplam : null,
          st: v.repolar.kirli ? "dev" : "live",
          ikon: "dal",
          ipucu: "Bu bilgisayardaki repolarda commit/push edilmemiş iş",
        },
    {
      anahtar: "bekleyen",
      ad: sunucu ? "Canlıya bekleyen" : "Çekilmemiş",
      deger: v.repolar.geride,
      birim: " commit",
      alt: v.repolar.geride ? `${v.repolar.toplam - v.repolar.guncel} repoda` : `${v.repolar.toplam} repo güncel`,
      oran: v.repolar.toplam ? v.repolar.guncel / v.repolar.toplam : null,
      st: v.repolar.geride ? "dev" : "live",
      ikon: "dal",
      ipucu: sunucu ? "GitHub'da olup sunucuda çalışmayan commitler — tıkla: yayın adımları" : "GitHub'da olup bu bilgisayara çekilmemiş commitler",
    },
    {
      anahtar: "dikkat",
      ad: "Dikkat",
      deger: v.dikkat.sorun + v.dikkat.not,
      alt: v.dikkat.sorun ? `${v.dikkat.sorun} sorun · ${v.dikkat.not} not` : v.dikkat.not ? `${v.dikkat.not} açık not` : "her şey yolunda",
      oran: v.dikkat.toplam ? v.dikkat.temiz / v.dikkat.toplam : null,
      st: v.dikkat.sorun ? "hata" : v.dikkat.not ? "warn" : "live",
      ikon: "uyari",
      ipucu: "Uyarısı olan proje ve modüller — tıkla: yalnız onları göster",
    },
    {
      anahtar: "adimlar",
      ad: "Adımlar",
      deger: v.adimlar.tamam,
      birim: `/${v.adimlar.toplam}`,
      alt: v.adimlar.engel ? `${v.adimlar.engel} engel bekliyor` : "engel yok",
      oran: v.adimlar.toplam ? v.adimlar.tamam / v.adimlar.toplam : null,
      st: v.adimlar.engel ? "warn" : "live",
      ikon: "gorev",
      ipucu: "projeler.json'daki sıradaki adımlar",
    },
  ];
  return k;
}

const CEVRE = 2 * Math.PI * 22;

function Halka({ oran, ikon }: { oran: number | null; ikon: Karo["ikon"] }) {
  const dolu = oran == null ? 0 : Math.max(0, Math.min(1, oran));
  return (
    <span className="halka" aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" className="halka-iz" />
        <circle cx="28" cy="28" r="22" className="halka-dolu" strokeDasharray={`${CEVRE * dolu} ${CEVRE}`} transform="rotate(-90 28 28)" />
        {Array.from({ length: 24 }, (_, i) => (
          <line key={i} x1="28" y1="1.5" x2="28" y2="3.5" transform={`rotate(${i * 15} 28 28)`} className="halka-tik" />
        ))}
      </svg>
      <span className="halka-ikon"><Svg ad={ikon} boyut={18} /></span>
    </span>
  );
}

function KaroSayi({ deger }: { deger: number }) {
  const n = useSayac(deger);
  return <>{n}</>;
}

/** Üst şerit: beş canlı gösterge. Her biri ilgili bölüme götürür. */
export function Vitaller({ veri, vit, git, dikey = false }: { veri: Anlik; vit: VitalTur; git?: (a: VitalAnahtar) => void; dikey?: boolean }) {
  return (
    <section id="ozet" className={`vitaller${dikey ? " dikey" : ""}`} aria-label="Canlı göstergeler">
      {karolar(veri, vit).map((k, i) => {
        const ortak = { className: `vital st-${k.st}`, style: { ["--i" as string]: i }, title: k.ipucu };
        const icerik = (
          <>
            <Halka oran={k.oran} ikon={k.ikon} />
            <span className="vital-govde">
              <span className="vital-ad">{k.ad}</span>
              <span className="vital-sayi">
                <KaroSayi deger={k.deger} />
                {k.birim && <small>{k.birim}</small>}
              </span>
              <span className="vital-alt">{k.alt}</span>
            </span>
          </>
        );
        // Duvar modunda (git yok) gösterge tıklanmaz: düğme değil, düz kutu.
        return git
          ? <button key={k.anahtar} type="button" {...ortak} onClick={() => git(k.anahtar)}>{icerik}</button>
          : <div key={k.anahtar} {...ortak}>{icerik}</div>;
      })}
    </section>
  );
}
