import type { IcDurum } from "../types";

const DURUM_AD: Record<string, string> = { healthy: "sağlıklı", ok: "sağlıklı", degraded: "zayıf", unhealthy: "bozuk" };

/** Proje detayında uygulamanın kendi sağlık ucunun özeti (yalnız sunucuda dolar). */
export function IcSaglik({ d }: { d: IcDurum }) {
  if (d.erisim === "yetki") {
    return (
      <div className="ic-saglik">
        <div className="bekleyen-baslik"><span className="etiketcik">İÇ SAĞLIK</span><span className="mono sessiz">token gerekli</span></div>
        <span className="sessiz" style={{ fontSize: 11.5 }}>Ayrıntı için Kurulum denetimine bak.</span>
      </div>
    );
  }
  if (d.erisim !== "ok") {
    return (
      <div className="ic-saglik hata">
        <div className="bekleyen-baslik"><span className="etiketcik">İÇ SAĞLIK</span><span className="mono">{d.hata ?? "okunamadı"}</span></div>
      </div>
    );
  }
  const st = d.durum === "healthy" || d.durum === "ok" ? "live" : d.durum === "degraded" ? "warn" : "warn";
  return (
    <div className={`ic-saglik st-${st}`}>
      <div className="bekleyen-baslik">
        <span className="etiketcik">İÇ SAĞLIK</span>
        <span className="pill">{DURUM_AD[d.durum ?? ""] ?? d.durum}</span>
      </div>
      <ul>
        {d.kontroller.map((k) => (
          <li key={k.anahtar} className={k.ok ? "ok" : "bozuk"} title={k.not ?? undefined}>
            <span className="ic-isaret" aria-hidden="true">{k.ok ? "✓" : "✗"}</span>
            <span>{k.ad}</span>
            <span className="mono sessiz">{k.ok ? (k.ms != null ? `${k.ms} ms` : "") : "yanıt yok"}</span>
          </li>
        ))}
        {d.migration && (
          <li className={d.migration.bekleyen ? "bekliyor" : "ok"} title={d.migration.dosyalar.join("\n") || undefined}>
            <span className="ic-isaret" aria-hidden="true">{d.migration.bekleyen ? "!" : "✓"}</span>
            <span>Migration defteri</span>
            <span className="mono sessiz">{d.migration.bekleyen ? `${d.migration.bekleyen} bekliyor` : "güncel"}</span>
          </li>
        )}
      </ul>
      {d.migration && d.migration.bekleyen > 0 && (
        <span className="sessiz" style={{ fontSize: 10.5 }}>Defter bayat olabilir: karar vermeden önce sunucuda <code>npm run migrate:verify</code>.</span>
      )}
    </div>
  );
}
