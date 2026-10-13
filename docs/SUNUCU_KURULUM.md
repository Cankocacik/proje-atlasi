# Proje Atlası — ofis sunucusu: kurulum, güncelleme, sorun giderme

Hedef: `https://atlas.rosbelportal.com` · yalnız portal kullanıcısının parolasıyla girilir ·
Rosbel ve Mutabiko pm2 loglarını canlı izler.

```
tarayıcı ──HTTPS──▶ Cloudflare ──tünel (rosbel-backend)──▶ cloudflared servisi
                                                          └─▶ 127.0.0.1:4321  proje-atlasi (pm2)
                                                                 ├─ pm2 jlist + log dosyaları
                                                                 ├─ git fetch: C:\SiparisOnayProjesi, C:\mutabik, C:\proje-atlasi
                                                                 ├─ GitHub API (sunucuda klonu olmayan repolar)
                                                                 └─ portal giriş ucu (127.0.0.1:4000) — parola doğrulama
```

Sunucuya port açılmaz; Atlas yalnız `127.0.0.1`'e bağlanır. Cloudflare'den gelen her istek
parola ister. Sunucunun masaüstünden `http://127.0.0.1:4321` parolasız açılır.

## Üç komut

| Ne zaman | Komut (sunucuda, `C:\proje-atlasi` içinde) |
|---|---|
| İlk kurulum ya da bir şey bozulduysa | `powershell -ExecutionPolicy Bypass -File scripts\kurulum.ps1` (**Yönetici** PowerShell) |
| Yeni sürüm geldiğinde (Atlas düğümünde "N commit canlıya alınmadı") | `powershell -ExecutionPolicy Bypass -File scripts\guncelle.ps1` |
| "Neden çalışmıyor?" | `npm run doktor` — ya da ekranda **Kurulum denetimi** paneli |

### kurulum.ps1 ne yapar

Tekrar tekrar çalıştırılabilir; yapılmış adımı atlar.

1. node / npm / git / pm2 var mı, Node ≥ 20.12 mi, yönetici mi
2. `package-lock.json` değiştiyse `npm ci` (önce Atlas durdurulur — dosya kilidi)
3. Arayüz kodun commit'inden derlenmemişse `npm run build`
4. `.env` yoksa örnekten oluşturur; oturum sırrı yoksa üretip yazar (ekrana basmaz)
5. `pm2 startOrRestart ecosystem.config.cjs --update-env` + `pm2 save`; Atlas yanıt verene kadar bekler
6. Cloudflare tüneli: `config.yml`'de alan adı kuralı yoksa **yedek alır** → kuralı 404 satırının
   üstüne ekler → `cloudflared tunnel ingress validate` → geçerse `Cloudflared` servisini yeniden
   başlatır (api.rosbelportal.com birkaç saniye kesilir); geçmezse yedeği geri koyar, servise dokunmaz.
   DNS kaydı yoksa `tunnel route dns` ile açar.
7. `npm run doktor`

Tünel adımı istenmiyorsa `-TuneliAtla`; cloudflared başka klasördeyse `-CloudflaredKlasoru D:\cf`.

Betik yapmayan tek şey **GitHub token**: GitHub → Settings → Developer settings →
Fine-grained tokens. Repository access: yalnız `tasarisko`, `ormoPython`
(sunucuda klonu olmayanlar; istersen tümü). Permissions: **Contents: Read** (Metadata kendiliğinden).
Değeri `.env` → `GITHUB_TOKEN=` satırına yaz → `pm2 restart proje-atlasi`.

### guncelle.ps1 ne yapar

1. Sunucudaki kopyada commit edilmemiş değişiklik varsa **durur** (üzerine yazmaz)
2. `git fetch` + yalnız ileri sarma (`--ff-only`)
3. `package-lock.json` değiştiyse `npm ci`
4. Arayüzü **yan klasörde** (`dist-yeni`) derler; çalışan sürüm derleme bitene kadar bozulmaz;
   bitince klasörler yer değiştirir (eskisi `dist-eski`)
5. pm2 yeniden başlatır ve Atlas'ın **yeni commit'i bildirmesini** bekler (`/api/surum`)
6. Herhangi biri başarısızsa kodu, bağımlılıkları ve arayüzü önceki hâline döndürür

### Kurulum denetimi neye bakar

Node sürümü · çalışma kipi · oturum sırrı · giriş (portal ucu ayakta mı) · arayüz derlemesi
güncel mi · her repo okunuyor mu ve origin'e erişiliyor mu · GitHub token her repoyu görüyor mu ·
pm2'de manifestteki süreçler var ve çalışıyor mu · tünelde alan adı kuralı · DNS · **dışarıdan
erişim** (Cloudflare'in kendi 404'ü = tünel kuralı yok; 530 = tünel kapalı; 502 = Atlas kapalı).

Atlas açılışta ve 30 dakikada bir kendini denetler; hata çıkarsa haritadaki **Proje Atlası**
düğümü kırmızıya döner ve olay günlüğüne yazılır. Her satır sorunu çözecek komutu da söyler.

## Giriş

Parola **Rosbel portalındaki `muhammed@rosbeltr.com` kullanıcısının parolasıdır**
(`ecosystem.config.cjs` → `ATLAS_PORTAL_EPOSTA`). Atlas parolayı aynı sunucudaki portal
backend'ine sorar; doğruysa portalın verdiği jetonun e-postası bu adresle eşleşmeli, portal
oturumu da hemen kapatılır. Portalda parola değişirse Atlas'ınki de değişir; hesap pasife
alınırsa giriş kapanır. Portal 4000 dışında bir portta çalışıyorsa `.env` →
`ATLAS_PORTAL_GIRIS_URL`.

## Dışarıdan doğrulama (kurulumdan sonra bir kez)

1. Telefondan (Wi-Fi kapalı) `https://atlas.rosbelportal.com` → parola ekranı.
2. Yanlış parola → "Parola yanlış."; 5 yanlıştan sonra 15 dk kilit.
3. Doğru parola → harita; sağ üstte rozet **SUNUCU**; Kurulum denetimi "temiz".

## Bilmek gerekenler

- **git fetch:** Atlas beş dakikada bir izlediği repolarda `git fetch` çalıştırır. Çalışma
  dosyalarına dokunmaz; yalnız `origin/main` bilgisini tazeler. "N commit canlıya alınmadı"
  uyarısı buradan gelir — Atlas'ın kendisi için de (güncelleme zamanı).
- **Loglar** pm2'nin kendi dosyalarından kuyruktan okunur; pm2-logrotate dosyayı döndürünce
  baştan başlar. stderr satırları ve `error/exception/hata` içeren satırlar hata sayılır;
  15 dk'da 10+ hata satırı projede uyarıya döner. Atlas açılmadan önce yazılmış satırların
  zamanı bilinmez ("önce" yazar).
- **Olay günlüğü** (`data/olaylar.json`, son 300) yalnız **değişimi** yazar: site düştü/kalktı,
  süreç durdu/yeniden başladı, yeni commit, canlıya alındı, Atlas açıldı, denetim sonucu
  değişti. Sekme arka plandayken düşüş/geri geliş tarayıcı bildirimi olarak gelir
  ("Bildirimleri aç"; sayfa kapalıyken bildirim gelmez).
- **Erişim geçmişi** (`data/saglik-gecmisi.json`) son 24 saati tutar; 5 dakikada bir diske yazılır.
- **Sağlık kuralı:** 2xx/3xx ve 401/403 ayakta; 404, 5xx ve ağ hatası değil.
- **Tüm oturumları kapatmak:** `.env`'de `ATLAS_OTURUM_SIRRI`'yi değiştir → `pm2 restart proje-atlasi`.
- Loglarda kişisel veri/sır olabilir; bu yüzden log ucu da parolanın arkasındadır.

## Elle kurulum (betik kullanılamazsa)

```powershell
cd C:\proje-atlasi
npm ci; npm run build
copy .env.example .env; npm run sir        # çıktıyı .env'e yaz
pm2 start ecosystem.config.cjs; pm2 save
```

`C:\cloudflared\config.yml` → `ingress:` listesinde en sondaki `- service: http_status:404`
satırının **üstüne**:

```yaml
  - hostname: atlas.rosbelportal.com
    service: http://127.0.0.1:4321
```

```powershell
& C:\cloudflared\cloudflared.exe --config C:\cloudflared\config.yml tunnel ingress validate
& C:\cloudflared\cloudflared.exe --config C:\cloudflared\config.yml tunnel route dns rosbel-backend atlas.rosbelportal.com
Restart-Service Cloudflared
```

`route dns` sunucuda `cert.pem` ister; hata verirse Cloudflare panelinden ekle: DNS → CNAME
`atlas` → `<tünel-kimliği>.cfargotunnel.com`, Proxied. Tünel kimliği `config.yml`'deki
`tunnel:` satırındadır.
