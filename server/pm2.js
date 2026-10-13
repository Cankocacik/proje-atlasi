// pm2 süreç durumu ve log dosyası takibi (yalnız pm2'nin kurulu olduğu makinede dolar).
import { exec } from "node:child_process";
import { open, stat } from "node:fs/promises";

/** `pm2 jlist` çıktısını sade süreç listesine çevirir (saf; test/pm2.test.js). */
export function jlistCevir(dizi, simdi = Date.now()) {
  return dizi.map((p) => {
    const e = p.pm2_env ?? {};
    return {
      ad: p.name,
      id: p.pm_id,
      durum: e.status ?? "bilinmiyor",
      calismaSn: e.status === "online" && e.pm_uptime ? Math.max(0, Math.round((simdi - e.pm_uptime) / 1000)) : 0,
      yenidenBaslama: e.restart_time ?? 0,
      bellekMb: p.monit?.memory != null ? Math.round(p.monit.memory / 1048576) : null,
      cpu: p.monit?.cpu ?? null,
      outLog: e.pm_out_log_path ?? null,
      errLog: e.pm_err_log_path ?? null,
    };
  });
}

/** pm2 yoksa (PC) null. Windows'ta pm2 bir .cmd sarmalayıcısı olduğu için kabukla çağrılır (sabit komut). */
export function pm2Listesi() {
  return new Promise((resolve) => {
    exec("pm2 jlist", { timeout: 15000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        // pm2 bazen JSON'dan önce uyarı satırı basar.
        const bas = stdout.indexOf("[");
        resolve(jlistCevir(JSON.parse(stdout.slice(bas))));
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Yeniden başlama sayacını izler: son 1 saatte kaç kez yeniden başladığını hesaplamak için
 * her gözlemde (zaman, sayaç) saklar.
 */
export function yenidenBaslamaIzleyici(pencereMs = 60 * 60_000) {
  const gecmis = new Map();
  return (ad, sayac, simdi = Date.now()) => {
    const l = (gecmis.get(ad) ?? []).filter((x) => simdi - x.t < pencereMs);
    l.push({ t: simdi, n: sayac });
    gecmis.set(ad, l);
    return Math.max(0, sayac - l[0].n);
  };
}

const HATA_DESENI = /\b(error|err!|exception|unhandled|fatal|econnrefused|etimedout|hata)\b/i;

/**
 * pm2 log dosyalarını kuyruktan izler. Dosya büyüdükçe yeni satırları okur; küçülürse
 * (pm2-logrotate) baştan başlar. Her süreç için son `tamponBoyu` satır bellekte kalır.
 */
export function logIzleyici({ yayinla, tamponBoyu = 400, hataPencereMs = 15 * 60_000 }) {
  const surecler = new Map();

  async function oku(yol, konum) {
    const s = await stat(yol).catch(() => null);
    if (!s) return { satirlar: [], konum: 0 };
    let bas = konum;
    if (konum === null) bas = Math.max(0, s.size - 64 * 1024);
    else if (s.size < konum) bas = 0;
    if (s.size <= bas) return { satirlar: [], konum: s.size };
    const dosya = await open(yol, "r");
    try {
      const boy = Math.min(s.size - bas, 512 * 1024);
      const okumaBasi = s.size - boy;
      const tampon = Buffer.alloc(boy);
      await dosya.read(tampon, 0, boy, okumaBasi);
      // Yazımı sürmekte olan son satırı bir sonraki taramaya bırak.
      const sonSatirSonu = tampon.lastIndexOf(0x0a);
      if (sonSatirSonu === -1) return { satirlar: [], konum: konum ?? okumaBasi };
      let metin = tampon.subarray(0, sonSatirSonu + 1).toString("utf8");
      if (konum === null && okumaBasi > 0) metin = metin.slice(metin.indexOf("\n") + 1);
      return { satirlar: metin.split(/\r?\n/).filter((x) => x.trim()), konum: okumaBasi + sonSatirSonu + 1 };
    } finally {
      await dosya.close();
    }
  }

  async function tara(listesi) {
    const simdi = Date.now();
    for (const p of listesi) {
      let k = surecler.get(p.ad);
      const ilk = !k;
      if (!k) {
        k = { satirlar: [], hatalar: [], out: { yol: p.outLog, konum: null }, err: { yol: p.errLog, konum: null } };
        surecler.set(p.ad, k);
      }
      const yeni = [];
      for (const akim of ["out", "err"]) {
        const a = k[akim];
        const yol = akim === "out" ? p.outLog : p.errLog;
        if (!yol) continue;
        if (a.yol !== yol) Object.assign(a, { yol, konum: null });
        const { satirlar, konum } = await oku(yol, a.konum);
        a.konum = konum;
        for (const metin of satirlar) {
          const hata = akim === "err" || HATA_DESENI.test(metin);
          yeni.push({ zaman: new Date(simdi).toISOString(), akim, hata, metin: metin.slice(0, 2000) });
          // İlk okumadaki geçmiş satırlar "son 15 dk" sayacına girmez (zamanları bilinmez).
          if (hata && !ilk) k.hatalar.push(simdi);
        }
      }
      k.hatalar = k.hatalar.filter((t) => simdi - t < hataPencereMs);
      if (yeni.length) {
        k.satirlar.push(...yeni);
        if (k.satirlar.length > tamponBoyu) k.satirlar.splice(0, k.satirlar.length - tamponBoyu);
        if (!ilk) yayinla({ surec: p.ad, satirlar: yeni });
      }
    }
  }

  return {
    tara,
    satirlar: (ad) => surecler.get(ad)?.satirlar ?? [],
    hataSayisi: (ad) => surecler.get(ad)?.hatalar.length ?? 0,
  };
}
