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

## Telegram bildirimi (isteğe bağlı)

Tarayıcı bildirimi yalnız sayfa açıkken gelir. Sayfa kapalıyken de haber almak için Telegram:
site düştü/kalktı, süreç durdu/yeniden çalışıyor, iç sağlık bozuldu/düzeldi, kurulum denetimi
sorun buldu/temizlendi. Yeni commit, canlıya alma ve Atlas açılışı **gönderilmez** (olay
günlüğünde durur). Aynı taramadaki olaylar tek mesajda; saatte en çok 20 mesaj.

1. Telegram'da **@BotFather** → `/newbot` → verdiği token'ı `.env` → `ATLAS_TELEGRAM_TOKEN=`.
2. Telegram'da yeni bota bir mesaj at (ya da botu bir gruba ekleyip grupta yaz).
3. `npm run telegram` → listelenen kendi sohbet kimliğini `.env` → `ATLAS_TELEGRAM_SOHBET=`.
4. `pm2 restart proje-atlasi` → ekranda Olay günlüğü → **Telegram'a deneme**.

**Günlük özet** (isteğe bağlı): `.env` → `ATLAS_TELEGRAM_OZET=08:30` — her gün o saatte tek mesaj:
dikkat bekleyenler, canlıya bekleyen commitler, erişimi %100'ün altında kalan siteler, son 24 saatin
olay sayısı. Yeniden başlatma aynı gün ikinci kez göndermez (`data/ozet.json`).

İkisinden biri boşsa Telegram kapalıdır ve hiçbir şey dışarı gitmez. Kurulum denetimi
"Telegram bildirimi" satırında botun adını ve sohbeti gösterir. Mesajda proje adları ve
olay metinleri (ör. "siparis-backend durdu") gider; log satırı, token, parola gitmez. İç sağlık
notu (DB hata metni), kurulum denetimi ayrıntısı (git çıktısı) ve GitHub hata ayrıntısı da evde
kalır — özette yalnız başlığı yazılır ("ERP veritabanı yanıt vermiyor").

## İç sağlık (veritabanı, ERP, migration defteri)

Atlas sunucuda, uygulamaların kendi ayrıntılı sağlık ucunu loopback'ten okur
(`projeler.json` → `icSaglik`): Rosbel `http://127.0.0.1:4000/api/health/detailed`,
Mutabiko `http://127.0.0.1:4100/api/health/detailed`. Proje detayında **İÇ SAĞLIK** kutusu:
portal veritabanı, ERP veritabanı, Redis (kullanılıyorsa), onay tutarlılığı (ERP'ye yazılıp
portala yazılamamış onay alarmı) ve migration defteri. Bozulan kontrol kırmızı uyarı + olay
günlüğü + (açıksa) tarayıcı bildirimi olur.

Rosbel'in ucu canlıda **token ister**. Bir kez:

1. Rosbel backend `.env`'inde `HEALTH_DETAILED_TOKEN` yoksa ekle (en az 16 karakter; rastgele
   üretmek için `C:\proje-atlasi`'da `npm run sir` çıktısının `=`'den sonrası kullanılabilir) →
   `pm2 restart siparis-backend --update-env`.
2. Aynı değeri Atlas `.env`'ine `ROSBEL_HEALTH_TOKEN=` olarak yaz → `pm2 restart proje-atlasi`.

Kurulum denetimi "İç sağlık · Rosbel Portal" satırında token yoksa / reddedildiyse söyler.
Migration defteri "N bekliyor" diyorsa önce `npm run migrate:verify` (defter bayat olabilir);
bilerek bayat bırakılan bir defter gürültü yapıyorsa `icSaglik.migrationUyarisi: false`.

## Canlıya bekleyen iş ve yayın adımları

Atlas izlediği repolarda beş dakikada bir `git fetch` yapar. Sunucudaki kopya GitHub'ın gerisindeyse
proje detayında **CANLIYA BEKLEYEN** kutusu çıkar: hangi commitler, kaç dosya ve bu dosyalardan
çıkarılan **sıralı yayın adımları** (her biri kopyalanabilir komut). Kurallar `projeler.json` →
`yayin.adimlar`'dadır; örneğin Rosbel için:

1. `cd C:/SiparisOnayProjesi; git pull --ff-only` (her zaman; ayrışmış dalda durur, birleştirme açmaz)
2. `backend/package*.json` değiştiyse `npm install` (npm ci değil)
3. `backend/migrations/` değiştiyse `npm run migrate:verify` — **karar noktası** (`dur: true`);
   **doğrudan `npm run migrate` değil**:
   canlıdaki `_migrations` defteri bayat olabilir (elle uygulanmış dosyalar "bekliyor" görünür).
   ELLE çıkanlar `npm run migrate:verify -- --isaretle` ile deftere yazılır, ancak sonra
   yalnız BEKLİYOR kalanlar için `npm run migrate`.
4. `backend/` değiştiyse `pm2 restart siparis-backend --update-env`
5. Yalnız `frontend/` değiştiyse: "Vercel'de, sunucuda iş yok"

**Toplu kopya** tek satır PowerShell zinciridir: `a; if ($?) { b; if ($?) { c } }` — bir adım hata
verirse (çakışan pull, başarısız npm) sonrakiler çalışmaz (5.1'de `&&` yok; alt alta yapıştırılan
satırlar öncekinin hatasına bakmadan çalışırdı). Zincir **karar noktasında biter**: migrate:verify'ın
çıktısı okunmadan pm2 restart yeni kodu canlıya almaz; kalan adımlar "kalanını kopyala" ile ayrı alınır.
Manifest denetimi `--ff-only`'siz `git pull`'u ve doğrudan `npm run migrate`'i uyarıyla işaretler.

Mutabiko'da web değişikliği build'den önce `pm2 stop mutabiko-web` ile başlar (ISR tuzağı), derleme
bozulursa yarım `.next` ile açılmaz; API `npm ci`'dan sonra migration kararına kadar kapalı kalır,
yeniden başlatma adımında açılır. Atlas'ın kendisi için tek adım `scripts/guncelle.ps1`.
Kopyaladığın komutu kendin çalıştırırsın — Atlas hiçbir şeyi kendiliğinden yayınlamaz.

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
