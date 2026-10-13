import { useCallback, useEffect, useState } from "react";
import type { Anlik, LogSatiri } from "../types";

export type OturumDurumu = "bakiliyor" | "giris" | "acik";
const LOG_SINIRI = 600;

/**
 * Önce oturum sorulur (sunucuda parola ister, PC'de doğrudan açılır).
 * Açıksa ilk veri GET ile, sonrası SSE ile gelir; saat her saniye işler.
 */
export function useAtlas() {
  const [oturum, setOturum] = useState<OturumDurumu>("bakiliyor");
  const [girisGerekli, setGirisGerekli] = useState(false);
  const [veri, setVeri] = useState<Anlik | null>(null);
  const [bagli, setBagli] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => new Date());
  const [loglar, setLoglar] = useState<Record<string, LogSatiri[]>>({});

  useEffect(() => {
    fetch("/api/oturum")
      .then((r) => r.json())
      .then((o: { girisGerekli: boolean; girisli: boolean }) => {
        setGirisGerekli(o.girisGerekli);
        setOturum(o.girisli ? "acik" : "giris");
      })
      .catch(() => setHata("Sunucuya ulaşılamadı."));
    const saat = setInterval(() => setSimdi(new Date()), 1000);
    return () => clearInterval(saat);
  }, []);

  useEffect(() => {
    if (oturum !== "acik") return;
    fetch("/api/durum")
      .then((r) => {
        if (r.status === 401) {
          setOturum("giris");
          return null;
        }
        return r.json();
      })
      .then((v: Anlik | null) => v && setVeri(v))
      .catch(() => setHata("Sunucuya ulaşılamadı."));
    const kaynak = new EventSource("/api/akis");
    kaynak.addEventListener("durum", (e) => {
      setVeri(JSON.parse((e as MessageEvent).data));
      setBagli(true);
      setHata(null);
    });
    kaynak.addEventListener("log", (e) => {
      const { surec, satirlar } = JSON.parse((e as MessageEvent).data) as { surec: string; satirlar: LogSatiri[] };
      setLoglar((l) => (l[surec] ? { ...l, [surec]: [...l[surec], ...satirlar].slice(-LOG_SINIRI) } : l));
    });
    kaynak.onopen = () => setBagli(true);
    kaynak.onerror = () => {
      setBagli(false);
      // Oturum düştüyse SSE 401 alır ama durumu göremez; oturumu yeniden sor.
      fetch("/api/oturum")
        .then((r) => r.json())
        .then((o) => !o.girisli && setOturum("giris"))
        .catch(() => {});
    };
    return () => kaynak.close();
  }, [oturum]);

  const post = useCallback(async (yol: string, govde?: unknown) => {
    const r = await fetch(yol, {
      method: "POST",
      headers: { "content-type": "application/json", "x-atlas": "1" },
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
    const veri = await r.json().catch(() => ({}));
    if (r.status === 401 && yol !== "/api/giris") setOturum("giris");
    if (!r.ok) throw new Error(veri.hata ?? `HTTP ${r.status}`);
    return veri;
  }, []);

  const hataYakala = useCallback((e: unknown) => setHata((e as Error).message), []);

  const giris = useCallback(
    async (parola: string) => {
      await post("/api/giris", { parola });
      setHata(null);
      setOturum("acik");
    },
    [post],
  );

  const cikis = useCallback(async () => {
    await post("/api/cikis").catch(() => {});
    setVeri(null);
    setLoglar({});
    setOturum("giris");
  }, [post]);

  const [taraniyor, setTaraniyor] = useState(false);
  const tara = useCallback(async () => {
    setTaraniyor(true);
    try {
      setVeri(await post("/api/yenile"));
    } catch (e) {
      hataYakala(e);
    } finally {
      setTaraniyor(false);
    }
  }, [post, hataYakala]);

  const adimIsaretle = useCallback(
    async (id: string, tamam: boolean) => {
      setVeri((v) => (v ? { ...v, adimlar: v.adimlar.map((a) => (a.id === id ? { ...a, tamam } : a)) } : v));
      await post("/api/adim", { id, tamam }).catch(hataYakala);
    },
    [post, hataYakala],
  );

  const repoAc = useCallback((id: string) => post("/api/ac", { id }).catch(hataYakala), [post, hataYakala]);

  /** Sürecin log geçmişini çeker; sonrası SSE "log" olaylarıyla eklenir. */
  const logYukle = useCallback(async (surec: string) => {
    const r = await fetch(`/api/log?surec=${encodeURIComponent(surec)}`);
    if (!r.ok) return;
    const { satirlar } = (await r.json()) as { satirlar: LogSatiri[] };
    setLoglar((l) => ({ ...l, [surec]: satirlar.slice(-LOG_SINIRI) }));
  }, []);

  return {
    oturum, girisGerekli, giris, cikis,
    veri, bagli, hata, simdi, tara, taraniyor, adimIsaretle, repoAc,
    loglar, logYukle,
  };
}
