import { useCallback, useEffect, useRef, useState } from "react";
import type { Olay } from "../types";
import { bildirilir, yeniOlaylar } from "../lib/olay";

const desteklenir = typeof window !== "undefined" && "Notification" in window;

/**
 * Sekme başlığına dikkat sayısını yazar; sayfa açıkken yeni bir düşüş/geri geliş olursa
 * (sekme arka plandaysa) tarayıcı bildirimi gösterir. Servis çalışanı yok: sayfa kapalıyken bildirim gelmez.
 */
export function useBildirim(olaylar: Olay[] | undefined, dikkatSayisi: number) {
  const [izin, setIzin] = useState<NotificationPermission | "yok">(desteklenir ? Notification.permission : "yok");
  const sonGorulen = useRef<number | null>(null);

  useEffect(() => {
    document.title = dikkatSayisi > 0 ? `(${dikkatSayisi}) Proje Atlası` : "Proje Atlası";
  }, [dikkatSayisi]);

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
