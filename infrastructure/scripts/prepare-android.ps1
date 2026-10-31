param([switch]$AcceptSdkLicenses)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$toolRoot = Join-Path $repoRoot '.local/android-toolchain'
$downloadRoot = Join-Path $toolRoot 'downloads'
$sdkRoot = Join-Path $toolRoot 'sdk'
New-Item -ItemType Directory -Force -Path $downloadRoot, $sdkRoot | Out-Null

function Get-VerifiedArchive([string]$Url, [string]$Name, [string]$Checksum) {
    $archive = Join-Path $downloadRoot $Name
    if (!(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Checksum) {
        Write-Host "Downloading $Name"
        Invoke-WebRequest -Uri $Url -OutFile "$archive.partial" -TimeoutSec 300
        if ((Get-FileHash -LiteralPath "$archive.partial" -Algorithm SHA256).Hash -ne $Checksum) {
            throw "Checksum mismatch for $Name; archive was not installed."
        }
        Move-Item -LiteralPath "$archive.partial" -Destination $archive -Force
    }
    return $archive
}

# Portable JDK: official Adoptium release metadata, pinned SHA-256.
$javaArchive = Get-VerifiedArchive `
    'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip' `
    'OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip' `
    'f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e'
$jdkRoot = Join-Path $toolRoot 'jdk-21.0.12.1+1'
if (!(Test-Path -LiteralPath (Join-Path $jdkRoot 'bin/java.exe'))) {
    Expand-Archive -LiteralPath $javaArchive -DestinationPath $toolRoot -Force
}
if (!(Test-Path -LiteralPath (Join-Path $jdkRoot 'bin/java.exe'))) { throw 'JDK extraction failed.' }

# Command-line SDK only; no Android Studio, emulator, account or paid service.
$sdkArchive = Get-VerifiedArchive `
    'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' `
    'commandlinetools-win-15859902_latest.zip' `
    '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
$commandRoot = Join-Path $sdkRoot 'cmdline-tools/latest'
if (!(Test-Path -LiteralPath (Join-Path $commandRoot 'bin/sdkmanager.bat'))) {
    $stagingRoot = Join-Path $toolRoot 'sdk-staging'
    Expand-Archive -LiteralPath $sdkArchive -DestinationPath $stagingRoot -Force
    New-Item -ItemType Directory -Force -Path (Split-Path $commandRoot) | Out-Null
    Move-Item -LiteralPath (Join-Path $stagingRoot 'cmdline-tools') -Destination $commandRoot
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle'
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME, $env:GRADLE_USER_HOME | Out-Null
$env:Path = "$(Join-Path $jdkRoot 'bin');$env:Path"
& (Join-Path $jdkRoot 'bin/java.exe') -version
if (!$AcceptSdkLicenses) {
    Write-Output 'Tool archives prepared. Review https://developer.android.com/studio and rerun with -AcceptSdkLicenses to install required SDK packages.'
    exit 0
}

# Accept only licenses prompted for the packages required by this Flutter version.
$answers = 1..20 | ForEach-Object { 'y' }
$answers | & (Join-Path $commandRoot 'bin/sdkmanager.bat') "--sdk_root=$sdkRoot" `
    'platform-tools' 'platforms;android-35' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;28.2.13676358' 'cmake;3.22.1'
if ($LASTEXITCODE -ne 0) { throw "SDK package installation failed ($LASTEXITCODE)." }
Write-Output "Android toolchain ready at $toolRoot. Environment changes apply only to this PowerShell process."
