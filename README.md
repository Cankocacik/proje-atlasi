# Proje Atlası

Kişisel proje haritası ve canlı takip ekranı. Repoları, sitelerin ayakta olup
olmadığını ve (sunucuda) pm2 süreçleriyle loglarını izler. Her zaman `127.0.0.1`'e
bağlanır.

- **PC'de (yerel):** parolasız, `ATLAS_ORTAM` boş.
- **Sunucuda:** `https://atlas.rosbelportal.com`, Cloudflare Tunnel + parola —
  kurulum: [docs/SUNUCU_KURULUM.md](docs/SUNUCU_KURULUM.md).

## Çalıştırma

```
npm install
npm run build     # arayüzü derle (kod değişince tekrar)
npm start         # http://127.0.0.1:4321
```

Geliştirirken: `npm run dev` (aynı adres, anında yenilenir). Test: `npm test`.
Masaüstünden tek tıkla açmak için `baslat.cmd`.

Kurulum denetimi: `npm run doktor` (sunucu ayarlarıyla) · `node scripts/doktor.js --yerel` (PC).
Sunucuda kurulum/güncelleme: `scripts\kurulum.ps1` · `scripts\guncelle.ps1`.

## Veri nereden gelir

| Ne | Kaynak | Sıklık |
|---|---|---|
| Son commit, dal, commit edilmemiş dosya, push edilmemiş commit | `git` (repo yolu manifestte) | `yenilemeSaniye` (20 sn) |
| Geride kalan commit (sunucuda "canlıya alınmadı") | `git fetch` | `fetchDakika` (5 dk) |
| Repo bu makinede yoksa commitler | GitHub API (`github`, `.env` → `GITHUB_TOKEN`) | `githubSaniye` (5 dk) |
| pm2 süreç durumu + loglar | `pm2 jlist` + log dosyaları (yalnız pm2 olan makinede) | 10 sn / 2 sn |
| Site ayakta mı, yanıt süresi | `saglik` adresine GET (2xx/3xx ve 401/403 = ayakta; 404, 5xx, ağ hatası = çökük) | `saglikSaniye` (60 sn) |
| Site erişim geçmişi (24 sa, 30 dk kutular) | sağlık yoklamaları → `data/saglik-gecmisi.json` | her yoklamada |
| Olay günlüğü (durum değişimleri) | ardışık anlık görüntü farkı → `data/olaylar.json` | her taramada |
| Kurulum denetimi | `server/doktor.js` (aynı kontroller `npm run doktor`'da) | açılışta + 30 dk |
| Aşama, açıklama, elle uyarı, sıradaki adımlar, harita konumu | `projeler.json` | dosya kaydedilince anında |
| Adım işaretleri | `data/adimlar.json` (ekrandan) | anında |

"Şimdi tara" site önbelleğini de atlar.

## Ekran

- **Üst şerit:** canlı saat, tek cümlelik durum ("2 sistem sorunlu · 3 sitenin hepsi ayakta…" —
  tıklayınca yalnız dikkat bekleyenler kalır) ve beş halkalı gösterge: siteler, pm2 süreçleri
  (PC'de yerel değişiklik), canlıya bekleyen / çekilmemiş commit, dikkat, adımlar. Her gösterge
  ilgili bölüme götürür. Sorun varken sayfanın tepesinde kırmızı nabız şeridi, sekme simgesinde
  kırmızı nokta yanar.
- **Harita:** fareyle üstüne gelince künye (site, 24 sa erişim, son commit, pm2, bekleyen iş),
  ok tuşlarıyla düğümler arası gezinme, Ctrl + tekerlekle yakınlaştırma, yakınken sürükleyerek
  kaydırma. Seçili düğümün bağları parlar; veri akışlarında parçacık akar; kartın altındaki ince
  şerit son 24 saatin erişimidir.
- **Komut paleti — `Ctrl K` (ya da `/`):** proje bul, bölüme git, siteyi aç, tara, denetle.
  Türkçe harf duyarsız ("gunlugu" → "Olay günlüğü").
- **Duvar modu — `D` ya da `/#duvar`:** televizyon / ikinci ekran için tek bakış: ekrana sığan
  harita, seçili düğümün künyesi, göstergeler, son olaylar ve kayan olay şeridi. Otomatik tur
  düğümleri 9 sn'de bir gezer (sorunlular önce); tam ekran düğmesi. Çıkış `Esc`.
- **Anlık bildirim kartları:** sayfa açıkken gelen yeni olay sağ altta görünür (üstüne gelince
  bekler), tıklayınca ilgili projeye gider.
- Kısayollar: `R` tara · `D` duvar modu · `L` harita/liste · `Esc` paleti/duvarı/süzgeci kapat.
  İşletim sisteminde "hareketi azalt" açıksa tüm döngüler (radar, parçacık, sayaç) durur.

## projeler.json alanları

| Alan | Anlamı |
|---|---|
| `id`, `ad`, `tur` | kimlik, görünen ad, alt yazı |
| `ikon` | `hub` · `product` · `tool` · `client` · `module` |
| `kart` | `true` = haritada kart; yoksa küçük nokta |
| `ust` | nokta düğümün bağlı olduğu kartın `id`'si (gri çizgi) |
| `asama` | `fikir` · `gelistirme` · `bekliyor` · `canli` · `beklemede` |
| `konum` | haritada `x`, `y` (px); kartta `w` genişlik. Harita varsayılan 780×540 |
| `repo` | git klasörü. `kapsam`: yalnız bu yollar (modül), `haric`: bu yollar hariç |
| `github`, `dal` | `sahip/ad` — `repo` bu makinede yoksa commitler buradan |
| `pm2` | izlenecek pm2 süreç adları (durmuş süreç, sık yeniden başlama, hata satırı → uyarı) |
| `atlasKendisi` | `true` olan düğüm Atlas'ın kendisidir; kurulum denetiminin hata/uyarıları buna düşer |
| `icSaglik` | `{ url, tokenEnv?, migrationUyarisi? }` — uygulamanın ayrıntılı sağlık ucu (yalnız sunucuda, loopback); `tokenEnv` token'ın değil, onu tutan `.env` değişkeninin adı |
| `yayin.adimlar` | `[{ yol, adim, not?, bilgi?, dur? }]` — canlıya bekleyen dosyalar bu kurallarla eşlenir, detayda sıralı **yayın adımları** çıkar. `yol: ""` her değişiklikte; `"backend/migrations/"` klasör öneki; kural sırası = uygulama sırası. `dur: true` karar noktası (toplu kopya orada biter, ör. migrate:verify). Yollarda **düz bölü** (`C:/klasor`): JSON'da `\b`, `\t` kaçışı sessizce bozulur |
| `saglik`, `url` | izlenecek adres, "aç" bağlantısı |
| `surum`, `aciklama` | elle yazılan sürüm ve kısa açıklama |
| `uyarilar` | elle eklenen dikkat satırları (dizi) |
| `adimlar` | `{ id, metin, etiket: "engel" \| "sirada" }` — "Sıradaki adımlar"a düşer |

`akislar`: `{ kaynak, hedef, etiket }` — iki düğüm arasında akan yeşil ok.

Aynı commit birden çok projede görünürse (ör. Rosbel geneli + Mutabakat
modülü) akışta en dar kapsamlı projeye yazılır.

## Güvenlik

- Yalnız `127.0.0.1`'e bağlanır; Host başlığı yerel ya da `ATLAS_HOST` olmalı.
- Cloudflare'den gelen (ya da yerel olmayan) her istek parola ister. Parola Rosbel
  portalındaki tek kullanıcınınkidir (`ATLAS_PORTAL_EPOSTA`; portal giriş ucuna sorulur,
  portal jetonu hemen kapatılır) ya da ayrı scrypt özeti (`ATLAS_PAROLA_HASH`).
  HMAC imzalı HttpOnly/SameSite=Strict/Secure çerez, IP başına 15 dk'da 5 deneme.
- Yazma istekleri (`POST`) özel başlık + aynı köken ister (CSRF).
- "VS Code'da aç" yalnız yerel ortamda ve yerel istekte çalışır.
- Panelden Claude/Codex çalıştırma bilerek YOK — `sonraki-faz/ajan-konsolu/NOT.md`.
