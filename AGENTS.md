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
  `projeler.json` doğrulaması; `pm2.js` süreç + log kuyruğu.
- `src/` Vite + React + TS. Renk/ölçü tokenları `src/styles.css` `:root` bloğunda.
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
- **Ana dala birleştirme kararı kullanıcınındır.** İş dalda yapılır, özetlenir, onay beklenir.
  Aynı anda iki ajan çalışıyorsa her biri kendi `git worktree`'sinde çalışır
  (ör. `C:\proje-atlasi-<konu>`); ortak çalışma klasöründe başkasının yarım işinin üstüne yazılmaz.
- **Canlı sunucuda elle iş:** kullanıcıya tek adım tek adım verilir; betik varsa betik önerilir.
- `npm audit fix --force` çalıştırılmaz; geliştirme aracı yükseltmesi ayrı commit'te,
  test + derleme geçerek yapılır.
