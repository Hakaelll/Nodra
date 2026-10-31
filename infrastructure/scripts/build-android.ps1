param([string]$ApiUrl = 'http://10.0.2.2:4000/api/v1')

$ErrorActionPreference = 'Stop'
$endpoint = [Uri]$ApiUrl
if (!$endpoint.IsAbsoluteUri -or $endpoint.Scheme -notin @('http', 'https') -or $endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment -or $endpoint.AbsolutePath.TrimEnd('/') -ne '/api/v1' -or [Uri]::CheckHostName($endpoint.Host) -eq [UriHostNameType]::Unknown) {
    throw 'API URL must be an absolute HTTP(S) endpoint ending in /api/v1, without credentials, query or fragment.'
}
$ApiUrl = $endpoint.GetLeftPart([UriPartial]::Authority) + '/api/v1'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$toolRoot = Join-Path $repoRoot '.local/android-toolchain'
$env:JAVA_HOME = Join-Path $toolRoot 'jdk-21.0.12.1+1'
$env:ANDROID_HOME = Join-Path $toolRoot 'sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
$env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle'
$env:Path = "$(Join-Path $env:JAVA_HOME 'bin');$env:Path"
foreach ($required in @(
    (Join-Path $env:JAVA_HOME 'bin/java.exe'),
    (Join-Path $env:ANDROID_HOME 'platforms/android-35/android.jar'),
    (Join-Path $env:ANDROID_HOME 'platforms/android-36/android.jar'),
    (Join-Path $env:ANDROID_HOME 'build-tools/36.0.0/aapt2.exe'),
    (Join-Path $env:ANDROID_HOME 'ndk/28.2.13676358/source.properties'),
    (Join-Path $env:ANDROID_HOME 'cmake/3.22.1/bin/cmake.exe')
)) {
    if (!(Test-Path -LiteralPath $required)) {
        throw 'Android toolchain is incomplete. Run prepare-android.ps1 first.'
    }
}
$flutter = Join-Path $repoRoot '.local/flutter/bin/flutter.bat'
if (!(Test-Path -LiteralPath $flutter)) { throw 'Expected local Flutter SDK at .local/flutter.' }
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME, $env:GRADLE_USER_HOME | Out-Null
Push-Location (Join-Path $repoRoot 'apps/mobile')
try {
    & $flutter build apk --debug --no-pub "--dart-define=API_URL=$ApiUrl"
    if ($LASTEXITCODE -ne 0) { throw "Android build failed ($LASTEXITCODE)." }
} finally {
    Pop-Location
}
