import { useCallback, useEffect, useRef, useState } from "react";
import type { Olay } from "../types";
import type { GenelDurum } from "../lib/durumOzeti";
import { bildirilir, yeniOlaylar } from "../lib/olay";
import { faviconSvg } from "../lib/favicon";

const desteklenir = typeof window !== "undefined" && "Notification" in window;

/**
 * Sekme başlığına dikkat sayısını, sekme simgesine genel durumu yazar; sayfa açıkken yeni bir
 * düşüş/geri geliş olursa (sekme arka plandaysa) tarayıcı bildirimi gösterir.
 * Servis çalışanı yok: sayfa kapalıyken bildirim gelmez (onun için Telegram).
 */
export function useBildirim(olaylar: Olay[] | undefined, sekme: { dikkat: number; genel: GenelDurum; vurgu: string }) {
  const [izin, setIzin] = useState<NotificationPermission | "yok">(desteklenir ? Notification.permission : "yok");
  const sonGorulen = useRef<number | null>(null);
  const { dikkat, genel, vurgu } = sekme;

  useEffect(() => {
    document.title = dikkat > 0 ? `(${dikkat}) Proje Atlası` : "Proje Atlası";
  }, [dikkat]);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconSvg(genel, vurgu);
  }, [genel, vurgu]);

  useEffect(() => {
    if (!olaylar) return;
    const { yeniler, enBuyuk } = yeniOlaylar(olaylar, sonGorulen.current);
    sonGorulen.current = enBuyuk;
    if (izin !== "granted" || !document.hidden) return;
    for (const o of yeniler.filter(bildirilir)) {
      try {
        new Notification("Proje Atlası", { body: o.metin, tag: `atlas-${o.id}` });
      } catch {
        // Bazı tarayıcılar sayfa içinden Notification oluşturmayı yasaklar; sessizce geç.
      }
    }
  }, [olaylar, izin]);

  const izinIste = useCallback(async () => {
    if (!desteklenir) return;
    setIzin(await Notification.requestPermission());
  }, []);

  return { izin, izinIste };
}
