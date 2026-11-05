# Android startup check, 5 November 2026

The existing debug APK was installed and launched on a temporary AOSP ATD emulator, API 35, using the host's available WHPX acceleration. No Windows feature was enabled. The emulator ran without a window, audio, snapshots or metrics. No Computer Use or visual inspection was performed.

| Observation | Result |
| --- | --- |
| APK | `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk` |
| SHA-256 | `caab2cc024c39a69b167ed97e0f92a92b5123d6abc1a4160d7fa96b812d4b9e4` |
| Guest package installation | `Success` |
| `am start -W -n dev.nodra.nodra/.MainActivity` | `Status: ok`, `LaunchState: COLD` |
| Foreground activity | `dev.nodra.nodra/.MainActivity` in `topResumedActivity` |
| Process | Same guest PID remained alive in subsequent checks |
| Startup log scan | No `FATAL EXCEPTION`, `Unhandled Exception`, `E/flutter` or `Fatal signal` match in that process's captured logs |
| Guest-to-host network | HTTP 200 from `192.168.1.133:4000/health/ready`, database up |

The network check used guest-shell netcat. It proves guest connectivity to the API, not an authenticated request made by the APK. The earlier Flutter HTTP probe separately exercises the production client classes. This startup check does not establish navigation correctness, secure-storage persistence across restarts, gallery behavior, visual acceptance, physical-device behavior or iOS compatibility.

The first network request was refused because web/API/worker and the Compose containers were stopped. Existing local services were restored without seed/reset, then the request passed. A netcat invocation that closed stdin immediately returned no response text; keeping it open briefly captured the actual HTTP response. Neither condition was treated as an application defect.

## Cleanup requested by the owner

After collecting results, the guest app was uninstalled, the named AVD stopped, and the SDK manager uninstalled both `emulator` and `system-images;android-35;aosp_atd;x86_64`. The AVD directory, logs and installer cache were removed after verifying paths and process termination. Their executable/package/AVD paths were confirmed absent. ADB was stopped after confirming no devices remained. Compilation SDK platforms 35/36, build tools, dependencies, signing key and the APK were preserved.

Earlier stopped PostgreSQL fixtures and inactive production-build/Vitest caches were also removed. Logical file sizes before removal were 158,619,910 bytes for three owned PostgreSQL fixtures, 103,246,310 for `.next/cache`, 455 for Vitest cache, 6,810,753 for Android tool cache and 3,865,433,627 for the AVD/log directory. Sparse files and filesystem allocation mean these are not measurements of physical disk space reclaimed. Active `.next-dev`, development data and Docker volumes were preserved.

Web LAN :3000, API LAN :4000/health/ready and worker loopback :4100/health/ready returned 200 after cleanup. No application source, permanent test case, paid service or CI workflow changed for this check. The emulator is deliberately not left installed.

Reference: [official emulator command-line options](https://developer.android.com/studio/run/emulator-commandline) and [acceleration check](https://developer.android.com/studio/run/emulator-acceleration). Local observations above, rather than the documentation alone, establish the recorded results.
