// Kurulum denetimi: Atlas'ın düzgün çalışması için gereken her şeyi tek tek yoklar.
// Hem `npm run doktor` (komut satırı) hem /api/doktor (ekran) bunu kullanır.
// Her sonuç: { ad, durum: "ok" | "uyari" | "hata" | "atla", mesaj, cozum? }
import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { icSaglikOku } from "./icSaglik.js";
import { manifestDogrula } from "./manifest.js";
import { pm2Listesi } from "./pm2.js";

// — saf yardımcılar (test/doktor.test.js) —

export function nodeSurumuYeterli(surum = process.version) {
  const [ana, ara] = surum.replace(/^v/, "").split(".").map(Number);
  // process.loadEnvFile 20.12 / 21.7 ile geldi.
  return ana > 21 || (ana === 21 && ara >= 7) || (ana === 20 && ara >= 12);
}

/** config.yml'de bu alan adı için bir ingress kuralı var mı (yorum satırları sayılmaz). */
export function configteHostVar(yaml, host) {
  const kacisli = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*-?\\s*hostname:\\s*["']?${kacisli}["']?\\s*$`, "mi").test(yaml);
}

export function githubDurumu(kod) {
  if (kod === 200) return { durum: "ok", mesaj: "erişim var" };
  if (kod === 401) return { durum: "hata", mesaj: "token geçersiz ya da süresi dolmuş", cozum: "GitHub'da yeni ince ayarlı token üret → .env GITHUB_TOKEN → pm2 restart proje-atlasi" };
  if (kod === 403) return { durum: "hata", mesaj: "erişim reddedildi ya da istek sınırı doldu", cozum: "Token izinlerinde Contents: Read-only olmalı; sınırsa bir saat bekle" };
  if (kod === 404) return { durum: "hata", mesaj: "token bu repoyu göremiyor", cozum: "Token → Repository access listesine bu repoyu ekle" };
  return { durum: "uyari", mesaj: `beklenmeyen yanıt (${kod})` };
}

/**
 * Dışarıdan /api/oturum yanıtını yorumlar. Cloudflare'in kendi 404'ü (Atlas'ın güvenlik
 * başlığı yok) "tünel kuralı yok", 530/1033 "tünel kapalı" demektir.
 */
export function disErisimYorumu({ kod, atlasBasligi, govde }) {
  if (kod === 200 && govde) {
    if (!govde.girisGerekli) return { durum: "hata", mesaj: "dışarıdan gelen istek yerel sayılıyor — parola istenmiyor!", cozum: "Tünel istekleri cf-connecting-ip taşımalı; cloudflared ayarını kontrol et" };
    if (!govde.kimlikHazir) return { durum: "hata", mesaj: "sayfa açılıyor ama giriş ayarlanmamış", cozum: "npm run sir → .env ATLAS_OTURUM_SIRRI → pm2 restart proje-atlasi" };
    return { durum: "ok", mesaj: "açılıyor, parola istiyor" };
  }
  if (kod === 404 && !atlasBasligi) return { durum: "hata", mesaj: "istek tünele ulaşıyor ama Atlas'a yönlenmiyor (Cloudflare 404)", cozum: "config.yml'e atlas kuralını ekle → Restart-Service Cloudflared (scripts/kurulum.ps1 yapar)" };
  if (kod === 530 || kod === 1033) return { durum: "hata", mesaj: `tünel kapalı (${kod})`, cozum: "Get-Service Cloudflared → çalışmıyorsa Start-Service Cloudflared" };
  if (kod === 502 || kod === 504) return { durum: "hata", mesaj: `tünel Atlas'a ulaşamıyor (${kod})`, cozum: "pm2 status → proje-atlasi online mı?" };
  return { durum: "uyari", mesaj: `beklenmeyen yanıt (${kod})` };
}

export function ozetle(sonuclar) {
  const say = (d) => sonuclar.filter((s) => s.durum === d).length;
  return { ok: say("ok"), uyari: say("uyari"), hata: say("hata"), atla: say("atla") };
}

// — yoklamalar —

function git(repo, args, zamanAsimi = 20000) {
  return new Promise((ok) => {
    execFile("git", ["-C", repo, ...args], { timeout: zamanAsimi, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (e, out, err) =>
      ok(e ? { hata: (err || e.message).trim().split("\n").pop() } : { cikti: out.trim() }));
  });
}

async function zamanli(ad, fn) {
  try {
    return { ad, ...(await fn()) };
  } catch (e) {
    return { ad, durum: "hata", mesaj: e?.message ?? String(e) };
  }
}

/**
 * ayar: ortamOku() çıktısı · manifest: projeler.json · kok: Atlas klasörü
 * Bağımlılıklar test için değiştirilebilir.
 */
export async function doktor({ ayar, manifest, kok, fetchFn = fetch, pm2Fn = pm2Listesi, dnsFn = lookup, cloudflaredConfig = process.env.ATLAS_CLOUDFLARED_CONFIG ?? "C:/cloudflared/config.yml" }) {
  const sunucu = ayar.ortam === "sunucu";
  const projeler = manifest?.projeler ?? [];
  const kontroller = [];

  kontroller.push(zamanli("Node sürümü", async () =>
    nodeSurumuYeterli()
      ? { durum: "ok", mesaj: process.version }
      : { durum: "hata", mesaj: `${process.version} — en az 20.12 gerekli`, cozum: "Node 22 LTS kur" }));

  kontroller.push(zamanli("Çalışma kipi", async () => {
    if (!sunucu) return { durum: "ok", mesaj: "yerel (PC) — parola istenmez" };
    return ayar.host
      ? { durum: "ok", mesaj: `sunucu · ${ayar.host}` }
      : { durum: "hata", mesaj: "sunucu kipinde ATLAS_HOST yok", cozum: "ecosystem.config.cjs → ATLAS_HOST" };
  }));

  kontroller.push(zamanli("Oturum sırrı", async () => {
    const uzunluk = ayar.oturumSirri?.length ?? 0;
    if (uzunluk >= 32) return { durum: "ok", mesaj: `${uzunluk} karakter` };
    return { durum: sunucu ? "hata" : "atla", mesaj: uzunluk ? `çok kısa (${uzunluk})` : "yok", cozum: "npm run sir → .env ATLAS_OTURUM_SIRRI → pm2 restart proje-atlasi" };
  }));

  kontroller.push(zamanli("Giriş", async () => {
    if (ayar.portalEposta) {
      try {
        const r = await fetchFn(ayar.portalGirisUrl, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) });
        // Boş gövdeye 400/401 beklenir: uç ayakta demektir.
        return { durum: "ok", mesaj: `portal kullanıcısı (${ayar.portalEposta}) · giriş ucu yanıt veriyor (${r.status})` };
      } catch (e) {
        return { durum: "hata", mesaj: `portal giriş ucuna ulaşılamıyor: ${e?.cause?.code ?? e.message}`, cozum: "siparis-backend çalışıyor mu? Port 4000 değilse .env ATLAS_PORTAL_GIRIS_URL" };
      }
    }
    if (ayar.parolaOzeti?.startsWith("scrypt$")) return { durum: "ok", mesaj: "ayrı parola (ATLAS_PAROLA_HASH)" };
    return { durum: sunucu ? "hata" : "atla", mesaj: "giriş ayarlanmamış", cozum: "ecosystem.config.cjs → ATLAS_PORTAL_EPOSTA" };
  }));

  kontroller.push(zamanli("Arayüz derlemesi", async () => {
    if (!existsSync(join(kok, "dist", "index.html"))) return { durum: "hata", mesaj: "dist/ yok", cozum: "npm run build" };
    const [isaret, head] = await Promise.all([
      readFile(join(kok, "dist", ".atlas-surum"), "utf8").then((s) => s.trim()).catch(() => null),
      git(kok, ["rev-parse", "--short", "HEAD"]),
    ]);
    if (!isaret || !head.cikti) return { durum: "ok", mesaj: "var (sürüm işareti yok)" };
    return isaret.startsWith(head.cikti) || head.cikti.startsWith(isaret)
      ? { durum: "ok", mesaj: `güncel (${isaret})` }
      : { durum: "uyari", mesaj: `arayüz ${isaret}'den derlenmiş, kod ${head.cikti}`, cozum: "scripts/guncelle.ps1 ya da npm run build → pm2 restart proje-atlasi" };
  }));

  kontroller.push(zamanli("projeler.json", async () => {
    const sorunlar = manifestDogrula(manifest);
    const hatalar = sorunlar.filter((s) => s.seviye === "hata");
    const ilk = (sorunlar.find((s) => s.seviye === "hata") ?? sorunlar[0]);
    if (!sorunlar.length) return { durum: "ok", mesaj: `${projeler.length} düğüm, sorun yok` };
    return {
      durum: hatalar.length ? "hata" : "uyari",
      mesaj: `${sorunlar.length} sorun — ilki: ${ilk.yer}: ${ilk.mesaj}`,
      cozum: "Tamamı ekranın üstündeki manifest şeridinde; dosyayı düzeltip kaydet (yeniden başlatma gerekmez)",
    };
  }));

  // Aynı repoyu paylaşan projeler için tek yoklama.
  const repolar = [...new Map(projeler.filter((p) => p.repo).map((p) => [p.repo, p])).values()];
  for (const p of repolar) {
    kontroller.push(zamanli(`Repo · ${p.repo}`, async () => {
      if (!existsSync(p.repo)) {
        const githubVar = projeler.some((x) => x.repo === p.repo && x.github);
        return githubVar
          ? { durum: "ok", mesaj: "bu makinede yok — GitHub'dan okunur" }
          : { durum: "uyari", mesaj: "bu makinede yok ve GitHub adresi tanımlı değil", cozum: "projeler.json → github: \"sahip/repo\"" };
      }
      const uzak = await git(p.repo, ["ls-remote", "--heads", "origin"]);
      return uzak.hata
        ? { durum: "uyari", mesaj: `okunuyor ama origin'e erişilemiyor: ${uzak.hata}`, cozum: "Bu kullanıcıyla bir kez `git fetch` çalıştırıp kimlik bilgisini kaydet" }
        : { durum: "ok", mesaj: "okunuyor, origin erişilebilir" };
    }));
  }

  const githubDepolari = [...new Set(projeler.filter((p) => p.github && !(p.repo && existsSync(p.repo))).map((p) => p.github))];
  for (const depo of githubDepolari) {
    kontroller.push(zamanli(`GitHub · ${depo}`, async () => {
      if (!ayar.githubToken) return { durum: "uyari", mesaj: "GITHUB_TOKEN yok — private repo okunamaz", cozum: "Salt-okur ince ayarlı token → .env GITHUB_TOKEN → pm2 restart proje-atlasi" };
      const r = await fetchFn(`https://api.github.com/repos/${depo}`, {
        headers: { accept: "application/vnd.github+json", authorization: `Bearer ${ayar.githubToken}`, "user-agent": "proje-atlasi" },
        signal: AbortSignal.timeout(10000),
      });
      const s = githubDurumu(r.status);
      const kalan = r.headers?.get?.("x-ratelimit-remaining");
      return { ...s, mesaj: kalan ? `${s.mesaj} · kalan istek ${kalan}` : s.mesaj };
    }));
  }

  for (const p of projeler.filter((x) => x.icSaglik?.url)) {
    kontroller.push(zamanli(`İç sağlık · ${p.ad}`, async () => {
      if (!sunucu) return { durum: "atla", mesaj: "yalnız sunucuda okunur" };
      const tokenEnv = p.icSaglik.tokenEnv;
      const s = await icSaglikOku(p.icSaglik, { fetchFn });
      if (s.erisim === "ag") return { durum: "hata", mesaj: `${p.icSaglik.url} ulaşılamıyor (${s.hata})`, cozum: `${(p.pm2 ?? [])[0] ?? "uygulama"} çalışıyor mu? pm2 status` };
      if (s.erisim === "yetki") {
        return tokenEnv && !s.tokenVar
          ? { durum: "uyari", mesaj: `token yok (.env ${tokenEnv})`, cozum: `Uygulamanın .env'inde HEALTH_DETAILED_TOKEN yoksa önce oraya ekle (en az 16 karakter; npm run sir ile üretilebilir) ve o uygulamayı yeniden başlat; aynı değeri Atlas .env'ine ${tokenEnv}= olarak yaz → pm2 restart proje-atlasi` }
          : { durum: "hata", mesaj: "token reddedildi", cozum: `${tokenEnv ?? "token"} uygulamadaki HEALTH_DETAILED_TOKEN ile aynı mı?` };
      }
      if (s.erisim !== "ok") return { durum: "uyari", mesaj: s.hata ?? "okunamadı" };
      const bozuk = s.kontroller.filter((k) => !k.ok).map((k) => k.ad);
      return bozuk.length
        ? { durum: "hata", mesaj: `${s.durum} — sorunlu: ${bozuk.join(", ")}` }
        : { durum: "ok", mesaj: `${s.durum} · ${s.kontroller.length} kontrol${s.migration ? ` · defterde ${s.migration.bekleyen} bekleyen migration` : ""}` };
    }));
  }

  kontroller.push(zamanli("pm2", async () => {
    const liste = await pm2Fn();
    if (!liste) return sunucu ? { durum: "hata", mesaj: "pm2 çalıştırılamadı", cozum: "Atlas'ı pm2'yi kuran kullanıcıyla başlat" } : { durum: "atla", mesaj: "bu makinede pm2 yok" };
    const beklenen = projeler.flatMap((p) => p.pm2 ?? []);
    const eksik = beklenen.filter((ad) => !liste.some((s) => s.ad === ad));
    const durmus = liste.filter((s) => s.durum !== "online").map((s) => `${s.ad} (${s.durum})`);
    if (eksik.length) return { durum: "uyari", mesaj: `manifestte olup pm2'de olmayan: ${eksik.join(", ")}`, cozum: "projeler.json'daki pm2 adlarını `pm2 status` ile karşılaştır" };
    if (durmus.length) return { durum: "hata", mesaj: `çalışmayan süreç: ${durmus.join(", ")}`, cozum: "pm2 logs <ad> --lines 50" };
    return { durum: "ok", mesaj: `${liste.length} süreç, hepsi online` };
  }));

  if (sunucu && ayar.host) {
    kontroller.push(zamanli("Cloudflare tüneli", async () => {
      if (!existsSync(cloudflaredConfig)) return { durum: "atla", mesaj: `${cloudflaredConfig} bulunamadı`, cozum: "Farklı yerdeyse ATLAS_CLOUDFLARED_CONFIG" };
      const yaml = await readFile(cloudflaredConfig, "utf8");
      return configteHostVar(yaml, ayar.host)
        ? { durum: "ok", mesaj: `${ayar.host} kuralı var` }
        : { durum: "hata", mesaj: `${ayar.host} için ingress kuralı yok`, cozum: "scripts/kurulum.ps1 (yönetici PowerShell)" };
    }));

    kontroller.push(zamanli("DNS", async () => {
      try {
        const { address } = await dnsFn(ayar.host);
        return { durum: "ok", mesaj: `${ayar.host} → ${address}` };
      } catch {
        return { durum: "hata", mesaj: `${ayar.host} çözülemiyor`, cozum: "cloudflared tunnel route dns <tünel> <alan-adı>" };
      }
    }));

    kontroller.push(zamanli("Dışarıdan erişim", async () => {
      try {
        const r = await fetchFn(`https://${ayar.host}/api/oturum`, { signal: AbortSignal.timeout(10000) });
        const govde = await r.json().catch(() => null);
        return disErisimYorumu({ kod: r.status, atlasBasligi: Boolean(r.headers?.get?.("x-frame-options")), govde });
      } catch (e) {
        return { durum: "hata", mesaj: `ulaşılamıyor: ${e?.cause?.code ?? e.message}` };
      }
    }));
  }

  const sonuclar = await Promise.all(kontroller);
  return { zaman: new Date().toISOString(), sonuclar, ozet: ozetle(sonuclar) };
}
