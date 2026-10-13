# Proje Atlası — ofis sunucusuna kurulum

Hedef: `https://atlas.rosbelportal.com` · yalnız portal kullanıcısının parolasıyla girilir · Rosbel ve
Mutabiko pm2 loglarını canlı izler.

```
tarayıcı ──HTTPS──▶ Cloudflare ──tünel (rosbel-backend)──▶ cloudflared servisi
                                                          └─▶ 127.0.0.1:4321  proje-atlasi (pm2)
                                                                 ├─ pm2 jlist + log dosyaları
                                                                 ├─ git fetch: C:\SiparisOnayProjesi, C:\mutabik
                                                                 └─ GitHub API (sunucuda klonu olmayan repolar)
```

Sunucuya port açılmaz; atlas yalnız `127.0.0.1`'e bağlanır. Cloudflare'den gelen
her istek parola ister. Sunucunun masaüstünden `http://127.0.0.1:4321` parolasız açılır.

## Ön koşul

- Node 22.11 + pm2 sunucuda var (Rosbel backend'iyle aynı kullanıcı — atlas
  `pm2 jlist` ile aynı pm2 örneğini okumalı).
- Cloudflared Windows servisi `C:\cloudflared\config.yml` ile `rosbel-backend`
  tünelini çalıştırıyor.

## 1 · Kodu sunucuya al

```powershell
cd C:\
git clone <atlas-repo-adresi> proje-atlasi
cd C:\proje-atlasi
npm ci
npm run build
```

## 2 · Gizli ayarlar (.env)

Giriş parolası **Rosbel portalındaki `muhammed@rosbeltr.com` kullanıcısının parolasıdır**
(`ecosystem.config.cjs` → `ATLAS_PORTAL_EPOSTA`). Atlas parolayı aynı sunucudaki portal
backend'ine sorar (`http://127.0.0.1:4000/api/auth/login`); doğruysa portalın verdiği
jetonun e-postası bu adresle eşleşmeli, portal oturumu da hemen kapatılır. Portalda
parola değişirse Atlas'ınki de değişir; hesap pasife alınırsa giriş kapanır.

```powershell
copy .env.example .env
npm run sir
```

`npm run sir` tek satır basar (`ATLAS_OTURUM_SIRRI=…`); `.env`'deki boş karşılığına
yapıştır. Portal backend'i 4000 dışında bir portta çalışıyorsa `ATLAS_PORTAL_GIRIS_URL`
satırını aç.

`GITHUB_TOKEN`: GitHub → Settings → Developer settings → Fine-grained tokens.
Repository access: yalnız `tasarisko`, `ormoPython` (sunucuda klonu olmayanlar;
istersen tümü). Permissions: **Contents: Read**, **Metadata: Read** — başka hiçbir şey.

## 3 · pm2 ile başlat

```powershell
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs proje-atlasi --lines 20
```

Beklenen satır: `Proje Atlası (sunucu) → http://127.0.0.1:4321 · dış adres: https://atlas.rosbelportal.com`.
Sunucunun tarayıcısında `http://127.0.0.1:4321` aç: harita + "Sunucu & loglar" paneli dolu olmalı.

## 4 · Tünele alan adı ekle

`C:\cloudflared\config.yml` → `ingress:` listesinde, en sondaki
`- service: http_status:404` satırının **üstüne**:

```yaml
  - hostname: atlas.rosbelportal.com
    service: http://127.0.0.1:4321
```

Sonra DNS kaydı ve servis yeniden başlatma. `route dns` sunucuda `cert.pem` ister;
hata verirse aynı kaydı Cloudflare panelinden elle ekle: DNS → CNAME `atlas` →
`<tünel-kimliği>.cfargotunnel.com`, Proxied (turuncu bulut). Tünel kimliği
`config.yml`'deki `tunnel:` satırındadır.

```powershell
cloudflared tunnel route dns rosbel-backend atlas.rosbelportal.com
Restart-Service Cloudflared
```

## 5 · Dışarıdan doğrula

1. Telefondan (Wi-Fi kapalı) `https://atlas.rosbelportal.com` → parola ekranı gelmeli.
2. Yanlış parola → "Parola yanlış."; 5 yanlıştan sonra 15 dk kilit.
3. Doğru parola → harita; sağ üstte rozet **SUNUCU**.
4. `pm2 logs proje-atlasi` içinde `[atlas] giriş: <ip>` satırı görünmeli.

## Güncelleme

```powershell
cd C:\proje-atlasi
git pull
npm ci          # yalnız package-lock değiştiyse; önce `pm2 stop proje-atlasi`
npm run build
pm2 restart proje-atlasi
```

`projeler.json` değişikliği yeniden başlatma istemez; kaydedince ekran yenilenir.

## Bilmek gerekenler

- **git fetch:** atlas beş dakikada bir `C:\SiparisOnayProjesi` ve `C:\mutabik`'te
  `git fetch` çalıştırır. Çalışma dosyalarına dokunmaz; yalnız `origin/main` bilgisini
  tazeler. "N commit canlıya alınmadı" uyarısı buradan gelir.
- **Loglar** pm2'nin kendi dosyalarından (`pm2 jlist` → `pm_out_log_path` /
  `pm_err_log_path`) kuyruktan okunur; pm2-logrotate dosyayı döndürünce baştan başlar.
  stderr satırları ve `error/exception/hata` içeren satırlar hata sayılır; 15 dk'da 10+
  hata satırı projede uyarıya döner.
- **Tüm oturumları kapatmak:** `.env`'de `ATLAS_OTURUM_SIRRI`'yi değiştir →
  `pm2 restart proje-atlasi`.
- **Parola değiştirmek:** portalda değiştir; Atlas aynı parolayı kullanır.
- Loglarda kişisel veri/sır olabilir; bu yüzden log ucu da parolanın arkasındadır.
