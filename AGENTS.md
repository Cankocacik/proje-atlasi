# Proje Atlası — ajanlar için çalışma kuralları

Bu depoda hem Claude Code hem Codex çalışır. Bu dosya ikisinin de ortak kılavuzudur
(Claude `CLAUDE.md` üzerinden buraya yönlenir).

## Ne bu

Muhammed'in kişisel "komuta merkezi": projelerini (Rosbel Portal ve modülleri, Mutabiko,
ORMO Gümrük, İceinox, Tasarım Botu, Patlangaç, Fashion Artwork, Atlas'ın kendisi) tek canlı
haritada gösterir; sunucuda pm2 süreçlerini ve loglarını izler. **Yalnız izleme yapar.**
Panelden Claude/Codex çalıştırma bilerek yok — kod `sonraki-faz/ajan-konsolu/`de park
edilmiştir, hiçbir yerden import edilmez; kullanıcı açıkça istemeden devreye alınmaz.

- Canlı: `https://atlas.rosbelportal.com` (ofis Windows sunucusu, pm2 `proje-atlasi`,
  Cloudflare Tunnel `rosbel-backend`). Giriş = Rosbel portal kullanıcısı
  `muhammed@rosbeltr.com`'un parolası (`server/portalGiris.js`).
- Yerel: `npm run dev` → `http://127.0.0.1:4321` (parolasız).

## Komutlar

| İş | Komut |
|---|---|
| Geliştirme | `npm run dev` |
| Test (vitest) | `npm test` — her değişiklikte |
| Tip denetimi | `npm run typecheck` |
| Derleme | `npm run build` (dist/.atlas-surum'a commit yazar) |
| Kurulum denetimi | `npm run doktor -- --yerel` (PC) · `npm run doktor` (sunucu ayarlarıyla) |
| Sunucu kurulum / güncelleme | `scripts\kurulum.ps1` · `scripts\guncelle.ps1` — `docs/SUNUCU_KURULUM.md` |

CI (`.github/workflows/ci.yml`, windows-latest): test + derleme + PowerShell 5.1 sözdizimi +
`projeler.json` denetimi.

## Yapı

- `server/` düz Node ESM, framework yok. `topla.js` her 20 sn anlık görüntü üretir; `api.js`
  HTTP + SSE (`/api/akis`) + kimlik; `turet.js` uyarı kuralları; `olaylar.js` durum değişimi
  günlüğü; `gecmis.js` site erişim geçmişi; `doktor.js` kurulum denetimi; `manifest.js`
  `projeler.json` doğrulaması; `pm2.js` süreç + log kuyruğu; `icSaglik.js` uygulamaların
  ayrıntılı sağlık ucu (yalnız sunucuda); `telegram.js` + `ozet.js` isteğe bağlı bildirim ve
  günlük özet; `bildirim.js` neyin bildirileceği (arayüzle ortak tek kaynak); `kutu.js` kart
  ölçüleri (arayüzle ortak).
- İzleme `server/index.js` dinlemeye başlayınca başlar (kimse sayfayı açmasa da işler);
  geliştirmede (`npm run dev`, vitest) tembel kalır.
- Tüm olay yazımı `api.js` → `olayEkle` üzerinden: günlük + (açıksa) Telegram aynı yoldan.
- `src/` Vite + React + TS. Renk/ölçü tokenları `src/styles.css` `:root` bloğunda.
  Arayüzün saf yardımcıları `src/lib/` (göstergeler `durumOzeti.ts`, palet araması `palet.ts`,
  ok tuşu gezinmesi `komsu.ts`, sekme simgesi `favicon.ts`, yayın komut zinciri `yayinKomutu.ts`)
  — `test/havali.test.ts`, `test/yayinKomutu.test.ts`.
- **Hareket kuralı:** yeni animasyon `prefers-reduced-motion`'a uyar. CSS döngüleri sondaki genel
  kuralla durur; SVG `<animateMotion>` CSS'i dinlemez → bileşen `useHareketAzalt()` ile hiç çizmez.
  Giriş animasyonu `animation-fill-mode: backwards` (bitince `transform` bırakmaz; hover'ı ezmez).
- **Durum rengi:** `--c` ton değişkeni `.st-live|dev|warn|idle|hata` sınıflarından gelir; bileşen
  kökünde `--c` varsayılanı yazılmaz (aynı özgüllükte sonra gelip `.st-*`'yi ezer) — gerekiyorsa
  `:where(.bilesen) { --c: … }`.
- `projeler.json` manifesttir; kaydedilince ekran kendini yeniler (yeniden başlatma gerekmez).

## Kurallar

- **Dil:** arayüz metni, hata mesajı, commit gövdesi, belge Türkçe. Kullanıcıyla Türkçe konuş.
- **Saf yardımcı + test:** DB/ağ/dosya dokunmayan mantık ayrı fonksiyon olur ve `test/` altında
  birim testle korunur (ör. `olaylariBul`, `kutula`, `manifestDogrula`, `disErisimYorumu`).
  Yeni otomatik uyarı → `server/turet.js` + test.
- **Uydurma veri yok:** ekrana yalnız gerçek kaynaktan (git, GitHub, pm2, site, manifest)
  gelen sayı yazılır. Bilinmeyen değer "—" / "kayıt yok" olur.
- **Gizli değer:** `.env` (oturum sırrı, GitHub token) repoya girmez, sohbete yazılmaz,
  loga basılmaz. `data/` (olaylar, erişim geçmişi, adım işaretleri) da repoya girmez.
- **Güvenlik kapıları korunur:** `uzakMi` / `istekUygun` (Host, köken, `x-atlas` başlığı),
  deneme sınırı portal sorgusundan ÖNCE. Uzak istek her zaman giriş ister.
- **Kart ölçüleri tek kaynak:** `server/kutu.js` (arayüz `src/lib/geometri.ts` üzerinden okur).
- **Sağlık kuralı:** 2xx/3xx ve 401/403 ayakta; 404, 5xx, ağ hatası değil (`server/saglik.js`).
- **Tarih karşılaştırması:** commit tarihi metin olarak karşılaştırılmaz (`Date.parse`): git `%cI`
  committer'ın kendi saat dilimini yazar.
- **Yayın adımı = kopyalanacak komut:** `projeler.json` → `yayin.adimlar`. Tehlikeli kısa yol
  yazılmaz (ör. doğrudan `npm run migrate` değil, önce `migrate:verify` — canlı defter bayat).
  Yollarda düz bölü (`C:/klasor`); JSON'da `\b`, `\t` kaçışı sessizce bozulur.
- **Dışarı giden her kanal varsayılan kapalı** (Telegram): yalnız `.env`'de alıcı tanımlıysa açılır;
  `ENABLE_*` bayrağı yazılmaz.
- **Ana dala birleştirme kararı kullanıcınındır.** İş dalda yapılır, özetlenir, onay beklenir.
  Aynı anda iki ajan çalışıyorsa her biri kendi `git worktree`'sinde çalışır
  (ör. `C:\proje-atlasi-<konu>`); ortak çalışma klasöründe başkasının yarım işinin üstüne yazılmaz.
- **Canlı sunucuda elle iş:** kullanıcıya tek adım tek adım verilir; betik varsa betik önerilir.
- `npm audit fix --force` çalıştırılmaz; geliştirme aracı yükseltmesi ayrı commit'te,
  test + derleme geçerek yapılır.
