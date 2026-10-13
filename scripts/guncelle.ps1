<#
.SYNOPSIS
  Proje Atlası'nı GitHub'daki son sürüme günceller; bir adım bozulursa önceki sürüme geri döner.

.DESCRIPTION
  git pull (yalnız ileri sarma) → package-lock değiştiyse npm ci → arayüzü YAN klasörde derle
  (dist-yeni; çalışan sürüm derleme bitene kadar bozulmaz) → klasörleri değiştir → pm2 yeniden başlat
  → Atlas yeni commit'i bildiriyor mu bak → kurulum denetimi.
  Derleme ya da açılış başarısızsa kod, bağımlılıklar ve arayüz önceki hâline döner.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File C:\proje-atlasi\scripts\guncelle.ps1
#>
[CmdletBinding()]
param([switch]$Zorla)

# 'Stop' kullanılmaz (bkz. kurulum.ps1): yerel komutlar $LASTEXITCODE ile denetlenir.
$ErrorActionPreference = 'Continue'
$Kok = Split-Path -Parent $PSScriptRoot
Set-Location $Kok -ErrorAction Stop

function Baslik($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Tamam($m) { Write-Host "  [tamam] $m" -ForegroundColor Green }
function Dur($m) { Write-Host "  [DUR]   $m" -ForegroundColor Red; exit 1 }

function AtlasSurumu {
  try { (Invoke-RestMethod http://127.0.0.1:4321/api/surum -TimeoutSec 3).commit } catch { $null }
}

Baslik 'Ön kontrol'
$kirli = git status --porcelain
if ($kirli) { Dur "Sunucudaki kopyada commit edilmemiş değişiklik var; güncelleme yapılmadı:`n$kirli" }
$onceki = (git rev-parse HEAD).Trim()
Tamam "şu an: $($onceki.Substring(0, 7))"

Baslik 'Kod'
git fetch --quiet
if ($LASTEXITCODE -ne 0) { Dur 'git fetch başarısız (ağ / GitHub kimliği)' }
git merge --ff-only --quiet '@{u}'
if ($LASTEXITCODE -ne 0) { Dur 'İleri sarma yapılamadı (sunucudaki dal GitHub''dan ayrışmış) — elle bak: git status' }
$yeni = (git rev-parse HEAD).Trim()
$kisa = $yeni.Substring(0, 7)
if ($yeni -eq $onceki -and -not $Zorla) {
  $calisan = AtlasSurumu
  if ($calisan -and $kisa.StartsWith($calisan.Substring(0, [Math]::Min(7, $calisan.Length)))) { Tamam "zaten güncel ve çalışıyor ($kisa)"; exit 0 }
  Write-Host "  Kod güncel ama çalışan sürüm farklı ($calisan) — yeniden başlatılıyor."
}
git --no-pager log --oneline "$onceki..$yeni"

$kilitDegisti = $false
$script:distDegisti = $false
if ($yeni -ne $onceki) {
  git diff --quiet $onceki $yeni -- package-lock.json
  $kilitDegisti = ($LASTEXITCODE -ne 0)
}

function GeriAl($neden) {
  Write-Host "`n  $neden — önceki sürüme dönülüyor…" -ForegroundColor Yellow
  git reset --hard --quiet $onceki
  if ($kilitDegisti) { npm ci --no-fund --no-audit | Out-Null }
  # Arayüz yalnız BU çalıştırmada değiştirildiyse geri alınır; yoksa dist-eski daha eski bir sürümdür.
  if ($script:distDegisti -and (Test-Path dist-eski)) {
    if (Test-Path dist) { Remove-Item dist -Recurse -Force }
    Rename-Item dist-eski dist
  }
  pm2 startOrRestart ecosystem.config.cjs --update-env | Out-Null
  Dur "Güncelleme geri alındı ($($onceki.Substring(0, 7)) çalışıyor). Sebep: $neden"
}

if ($kilitDegisti -or -not (Test-Path node_modules)) {
  Baslik 'Bağımlılıklar'
  pm2 stop proje-atlasi *> $null
  npm ci --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { GeriAl 'npm ci başarısız' }
  [IO.File]::WriteAllText((Join-Path $Kok 'node_modules\.atlas-kilit'), (Get-FileHash package-lock.json -Algorithm SHA256).Hash)
  Tamam 'npm ci tamam'
}

Baslik 'Arayüz'
if (Test-Path dist-yeni) { Remove-Item dist-yeni -Recurse -Force }
npm run build -- --outDir dist-yeni --emptyOutDir
if ($LASTEXITCODE -ne 0) { if (Test-Path dist-yeni) { Remove-Item dist-yeni -Recurse -Force }; GeriAl 'derleme başarısız' }
if (Test-Path dist-eski) { Remove-Item dist-eski -Recurse -Force }
if (Test-Path dist) { Rename-Item dist dist-eski }
Rename-Item dist-yeni dist
$script:distDegisti = $true
Tamam "derlendi ($kisa)"

Baslik 'Yeniden başlatma'
pm2 startOrRestart ecosystem.config.cjs --update-env | Out-Null
$calisan = $null
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  $calisan = AtlasSurumu
  if ($calisan -and $kisa.StartsWith($calisan.Substring(0, [Math]::Min(7, $calisan.Length)))) { break }
}
if (-not $calisan -or -not $kisa.StartsWith($calisan.Substring(0, [Math]::Min(7, $calisan.Length)))) { GeriAl "Atlas 20 sn içinde yeni sürümle açılmadı (bildirilen: $calisan)" }
pm2 save | Out-Null
Tamam "Atlas $kisa ile çalışıyor"

Baslik 'Kurulum denetimi'
node scripts/doktor.js
exit 0
