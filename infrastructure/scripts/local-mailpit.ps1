$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$store = Join-Path $root '.local\mailpit'
$version = 'v1.31.1'
$archive = Join-Path $store "mailpit-windows-amd64-$version.zip"
$binary = Join-Path $store "$version\mailpit.exe"
$archiveHash = '73ff05204741bd89cc96e6074573c4b22e1edfadf1b3427536233ff20c751604'
$binaryHash = '6b477b7728d09a3a24dff349d5447abaefa34e47d9f32153ca543e3fc7d6ce2e'

New-Item -ItemType Directory -Path $store -Force | Out-Null
if (-not (Test-Path -LiteralPath $binary)) {
  if (-not (Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest -Uri "https://github.com/axllent/mailpit/releases/download/$version/mailpit-windows-amd64.zip" -OutFile $archive -TimeoutSec 60
  }
  $actualArchiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualArchiveHash -ne $archiveHash) {
    throw 'El SHA-256 del archivo Mailpit no coincide con el release oficial.'
  }
  Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $store $version)
}
$actualBinaryHash = (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualBinaryHash -ne $binaryHash) {
  throw 'El SHA-256 del ejecutable Mailpit no coincide con el binario verificado.'
}

& $binary --listen '127.0.0.1:8025' --smtp '127.0.0.1:1025' --database (Join-Path $store 'mailpit.db') --disable-version-check
