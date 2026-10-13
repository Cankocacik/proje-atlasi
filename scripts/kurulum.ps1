<#
.SYNOPSIS
  Proje Atlası sunucu kurulumu — tekrar tekrar çalıştırılabilir; yapılmış adımı atlar.

.DESCRIPTION
  1. Ön koşullar (node, npm, git, pm2; yönetici yetkisi)
  2. Bağımlılıklar (package-lock değiştiyse npm ci)
  3. Arayüz derlemesi (kod commit'i ile derleme işareti farklıysa)
  4. .env (yoksa örnekten; oturum sırrı yoksa üretir — ekrana basmaz)
  5. pm2 (başlat ya da ortamı tazeleyerek yeniden başlat; pm2 save)
  6. Cloudflare tüneli (config.yml'e kural: yedek al → ekle → doğrula → servis; DNS kaydı)
  7. Kurulum denetimi (npm run doktor)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File C:\proje-atlasi\scripts\kurulum.ps1
#>
[CmdletBinding()]
param(
  [string]$CloudflaredKlasoru = 'C:\cloudflared',
  [string]$TunelAdi = 'rosbel-backend',
  [switch]$TuneliAtla
)

# 'Stop' KULLANILMAZ: Windows PowerShell 5.1'de stderr'e yazan yerel komut (npm, pm2, cloudflared)
# o zaman hata sayılıp betiği keser. Yerel komutlar $LASTEXITCODE ile, cmdlet'ler -ErrorAction Stop ile denetlenir.
$ErrorActionPreference = 'Continue'
$Kok = Split-Path -Parent $PSScriptRoot
Set-Location $Kok -ErrorAction Stop

function Baslik($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Tamam($m) { Write-Host "  [tamam] $m" -ForegroundColor Green }
function Uyari($m) { Write-Host "  [uyarı] $m" -ForegroundColor Yellow }
function Dur($m) { Write-Host "  [DUR]   $m" -ForegroundColor Red; exit 1 }
function KomutVar($ad) { [bool](Get-Command $ad -ErrorAction SilentlyContinue) }
function UTF8Yaz($yol, $metin) { [IO.File]::WriteAllText($yol, $metin, (New-Object Text.UTF8Encoding $false)) }

# ---------------------------------------------------------------- 1
Baslik 'Ön koşullar'
foreach ($k in 'node', 'npm', 'git', 'pm2') { if (-not (KomutVar $k)) { Dur "$k bulunamadı (PATH)" } }
$nodeSurum = (node -p "process.versions.node").Trim()
$ana, $ara = $nodeSurum.Split('.')[0..1] | ForEach-Object { [int]$_ }
if (-not ($ana -gt 21 -or ($ana -eq 21 -and $ara -ge 7) -or ($ana -eq 20 -and $ara -ge 12))) { Dur "Node $nodeSurum — en az 20.12 gerekli" }
Tamam "node $nodeSurum · git · pm2"
$yonetici = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $yonetici -and -not $TuneliAtla) { Dur 'Tünel adımı servis yeniden başlatır: PowerShell''i "Yönetici olarak çalıştır" ile aç (ya da -TuneliAtla)' }

# ---------------------------------------------------------------- 2
Baslik 'Bağımlılıklar'
$kilitOzeti = (Get-FileHash package-lock.json -Algorithm SHA256).Hash
$isaretYolu = Join-Path $Kok 'node_modules\.atlas-kilit'
$oncekiOzet = if (Test-Path $isaretYolu) { (Get-Content $isaretYolu -Raw).Trim() } else { '' }
if ((Test-Path node_modules) -and $oncekiOzet -eq $kilitOzeti) {
  Tamam 'güncel (npm ci gerekmedi)'
} else {
  # Çalışan süreç node_modules'ü kilitler; npm ci öncesi durdurulur.
  pm2 stop proje-atlasi *> $null
  npm ci --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { Dur 'npm ci başarısız' }
  UTF8Yaz $isaretYolu $kilitOzeti
  Tamam 'npm ci tamam'
}

# ---------------------------------------------------------------- 3
Baslik 'Arayüz derlemesi'
$head = (git rev-parse --short HEAD).Trim()
$derleme = if (Test-Path dist\.atlas-surum) { (Get-Content dist\.atlas-surum -Raw).Trim() } else { '' }
if ((Test-Path dist\index.html) -and $derleme -and ($head.StartsWith($derleme) -or $derleme.StartsWith($head))) {
  Tamam "güncel ($derleme)"
} else {
  npm run build
  if ($LASTEXITCODE -ne 0) { Dur 'derleme başarısız' }
  Tamam "derlendi ($head)"
}

# ---------------------------------------------------------------- 4
Baslik '.env'
$envYolu = Join-Path $Kok '.env'
if (-not (Test-Path $envYolu)) { Copy-Item (Join-Path $Kok '.env.example') $envYolu -ErrorAction Stop; Tamam '.env örnekten oluşturuldu' }
$satirlar = @(Get-Content $envYolu)
$sir = ($satirlar | Where-Object { $_ -match '^ATLAS_OTURUM_SIRRI=(.*)$' } | ForEach-Object { $Matches[1].Trim() }) -join ''
if ($sir.Length -ge 32) {
  Tamam 'oturum sırrı var'
} else {
  $yeni = (node scripts/sir.js).Trim()
  if ($satirlar -match '^ATLAS_OTURUM_SIRRI=') { $satirlar = $satirlar -replace '^ATLAS_OTURUM_SIRRI=.*$', $yeni } else { $satirlar += $yeni }
  [IO.File]::WriteAllLines($envYolu, [string[]]$satirlar, (New-Object Text.UTF8Encoding $false))
  Tamam 'oturum sırrı üretildi ve .env''e yazıldı'
}
$token = ($satirlar | Where-Object { $_ -match '^GITHUB_TOKEN=(.*)$' } | ForEach-Object { $Matches[1].Trim() }) -join ''
if (-not $token) { Uyari 'GITHUB_TOKEN boş — ORMO/Tasarım Botu commitleri okunamaz (docs/SUNUCU_KURULUM.md §2)' }

# ---------------------------------------------------------------- 5
Baslik 'pm2'
pm2 startOrRestart ecosystem.config.cjs --update-env | Out-Null
if ($LASTEXITCODE -ne 0) { Dur 'pm2 başlatamadı' }
pm2 save | Out-Null
$surum = $null
for ($i = 0; $i -lt 15 -and -not $surum; $i++) {
  Start-Sleep -Seconds 1
  try { $surum = Invoke-RestMethod http://127.0.0.1:4321/api/surum -TimeoutSec 3 } catch { }
}
if (-not $surum) { Dur 'Atlas 15 sn içinde yanıt vermedi — pm2 logs proje-atlasi --lines 40' }
Tamam "Atlas çalışıyor ($($surum.commit))"

# ---------------------------------------------------------------- 6
if ($TuneliAtla) {
  Baslik 'Cloudflare tüneli (atlandı)'
} else {
  Baslik 'Cloudflare tüneli'
  $alanAdi = (node -p "require('./ecosystem.config.cjs').apps[0].env.ATLAS_HOST").Trim()
  $cfg = Join-Path $CloudflaredKlasoru 'config.yml'
  $exe = Join-Path $CloudflaredKlasoru 'cloudflared.exe'
  if (-not (Test-Path $cfg)) { Dur "$cfg yok (-CloudflaredKlasoru)" }
  if (-not (Test-Path $exe)) { Dur "$exe yok (-CloudflaredKlasoru)" }

  $icerik = [IO.File]::ReadAllText($cfg)
  $kacisli = [regex]::Escape($alanAdi)
  $degisti = $false
  if ($icerik -match "(?m)^\s*-?\s*hostname:\s*[`"']?$kacisli[`"']?\s*$") {
    Tamam "$alanAdi kuralı zaten var"
  } else {
    if ($icerik -notmatch '(?m)^\s*- service: http_status:404') { Dur 'config.yml''de son kural (- service: http_status:404) bulunamadı; elle ekle' }
    $yedek = "$cfg.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item $cfg $yedek -ErrorAction Stop
    $sb = if ($icerik.Contains("`r`n")) { "`r`n" } else { "`n" }
    $icerik = $icerik -replace '(?m)^(\s*)- service: http_status:404', ("`$1- hostname: $alanAdi$sb`$1  service: http://127.0.0.1:4321$sb`$1- service: http_status:404")
    UTF8Yaz $cfg $icerik
    & $exe --config $cfg tunnel ingress validate 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Copy-Item $yedek $cfg -Force; Dur "config geçersiz çıktı — yedek geri yüklendi ($yedek), servise dokunulmadı" }
    $degisti = $true
    Tamam "kural eklendi (yedek: $yedek)"
  }

  if (Resolve-DnsName $alanAdi -ErrorAction SilentlyContinue) {
    Tamam "DNS kaydı var"
  } else {
    & $exe --config $cfg tunnel route dns $TunelAdi $alanAdi
    if ($LASTEXITCODE -ne 0) { Uyari "DNS kaydı açılamadı — Cloudflare panelinden CNAME ekle (docs/SUNUCU_KURULUM.md §4)" } else { Tamam 'DNS kaydı açıldı' }
  }

  if ($degisti) {
    $servis = Get-Service | Where-Object { $_.Name -like '*cloudflared*' } | Select-Object -First 1
    if (-not $servis) { Dur 'Cloudflared servisi bulunamadı' }
    Write-Host "  Tünel servisi yeniden başlıyor — api.rosbelportal.com birkaç saniye kesilir…"
    Restart-Service $servis.Name -ErrorAction Stop
    Start-Sleep -Seconds 8
    Tamam "$($servis.Name) yeniden başladı"
  }
}

# ---------------------------------------------------------------- 7
Baslik 'Kurulum denetimi'
node scripts/doktor.js
if ($LASTEXITCODE -eq 0) { Write-Host "`nKurulum tamam." -ForegroundColor Green } else { Write-Host "`nDenetim sorun buldu — yukarıdaki → satırlarına bak." -ForegroundColor Yellow }
