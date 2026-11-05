# Bootstrap validation, 5 November 2026

Source commit: `54aa8da21f143ab6a361289636ac8d375ea9a620`. This record supersedes the open component findings in the 3 November gate report. It does not certify production readiness or manual acceptance.

## Commands executed in this review

| Check | Observed result |
| --- | --- |
| `pnpm lint` | Passed, no warnings allowed |
| `pnpm typecheck` | All six child workspaces passed |
| `pnpm build` | Shared packages, API, worker and Next production/standalone build passed |
| `pnpm test` | Four essential web tests passed |
| `pnpm db:migrate:test` | Fourteen migrations applied only to the separate `nodra_test` database |
| `pnpm test:integration` | Thirteen PostgreSQL cases passed; 29.21 seconds total |
| `pnpm verify:api-contract` | 69 controller/documented operations, 60 protected operations and three parser boundaries verified |
| `pnpm deps:inventory` | 477 installed records, zero missing required references and 152 missing optional references |
| `pnpm exec prisma validate` | Schema valid |
| `docker compose config --quiet` | Passed |
| `docker compose --profile test ps` | PostgreSQL, postgres-test, Valkey and Mailpit healthy |
| `pnpm db:verify-bootstrap` | Empty database migrated fourteen times; seed ran twice; expected entity counts and real API reads passed |
| `pnpm test:web-vertical` | Real HTTP/BFF coordination, shared refresh and service chat/removal passed |

The bootstrap fixture `nodra_verify_8a8b4eb585cb988e` and HTTP fixture `nodra_verify_ff7200c11a665aba` were removed by their guarded cleanup. Neither command seeded or reset the development database. The bootstrap confirmed four users, one organization, four Memberships, one role, one group and member, three services and positions, and one interest, assignment, confirmation and notice.

The HTTP verifier exercised two cookie sessions, invitation acceptance, interest, selection, persisted confirmation and a service chat. Two expired tabs produced one coordinated refresh and retained authenticated access. Chat removal used an empty-body DELETE through the BFF, hid only the caller's entry and recovered it on a new message. This is HTTP verification, not browser DOM automation.

## Other evidence from the same day

The mobile source at `eee5d7a3cf9a927c7223b9c86d7563c287c6d230` passed Flutter analysis, its three retained session tests, a temporary component interaction probe and Android debug compilation. No Dart source changed afterward. The APK and its SHA-256 are recorded in [TESTING](../TESTING.md). Together with the four web and thirteen API cases, the permanent suite remains twenty cases.

The real Flutter HTTP probe completed registration, invitation, restored organization context, service list/detail, interest and assignment confirmation using production client classes. Only secure storage was replaced by separate memory stores. The owner/invitation probe observed one successful departure and one 409 from two active owners, retaining one active owner and one removal audit; expired/revoked links and codes produced eight rejections without uses or new Memberships. Their isolated databases were removed. These probes do not establish all concurrency schedules or device behavior.

Sections 182 and 183 now have shared components used by web and Flutter screens. Their earlier missing-component findings are historical. The current design remains [design.md](../design.md), with the owner's later navigation, control and mobile instructions taking precedence.

## Scope and remaining acceptance

Section 271 explicitly places macOS, Xcode, Apple Developer and APNs in future setup. Section 55 prepares the device-token model; remote push acquisition and delivery remain future work. These are not prerequisites for the local Android APK. Section 177 permits future roadmap features to remain specified in NEXT_TODOS; it does not permit claiming them implemented.

Full browser interaction, physical mobile use, iOS compilation and the owner's visual acceptance remain unverified. Availability, advanced notice targets, custom fields, presets, native deep-link distribution and commercial providers remain documented future scope. No Computer Use, subagents, additional permanent test cases, paid service or GitHub CI workflow was introduced.

Vite's future native-loader warning and pg's overlapping-query deprecation remain visible; both test commands passed. Dependency metadata still reports `seq-queue@0.0.5` without a package license field; its included LICENSE states MIT. The inventory is not a vulnerability scan or a legal review of all native binaries and container images. The full requirement audit and its dated corrections remain necessary; green gates alone do not prove every prompt requirement complete.
