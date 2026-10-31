# Nodra

Private service coordination for teams.

Nodra helps organizations publish services, define positions, select participants, and confirm attendance. Teams can track schedules, send notices with read acknowledgements, and discuss work in manual or service-based chats.

**Status:** Active development. The core workflows are implemented, but the full requirements and production readiness are still under review. See [project status](PROJECT_STATE.md) and [remaining work](NEXT_TODOS.md) for current evidence and limitations. Most internal documentation is currently in Spanish.

## Capabilities

- **Organizations and access:** Membership-based permissions, invitation links and codes, job roles, and groups.
- **Service coordination:** Drafts, positions, applications, participant selection, confirmation, cancellation, and completion.
- **Schedules:** Organization time zones, daylight saving time handling, calendar views, and service filters.
- **Communication:** Notices with recipient snapshots and read acknowledgements, persistent notifications, and chats with unread counts.
- **Profiles:** Editable names and device photo uploads with circular cropping.
- **Clients:** A responsive web application and a Flutter client with Android and iOS project scaffolds.

Nodra is not an ERP, a marketplace, or a payment platform. Local development requires no paid services or external accounts.

## Architecture

The backend is a modular monolith. PostgreSQL transactions and database constraints protect capacity, invitations, and tenant relationships. The backend authorizes requests through an active Membership rather than trusting organization context from a client.

| Component                             | Technology                           | Location         |
| ------------------------------------- | ------------------------------------ | ---------------- |
| API and domain rules                  | NestJS, Fastify, Prisma, PostgreSQL  | `apps/api`       |
| Notification processing               | Transactional outbox, BullMQ, Valkey | `apps/worker`    |
| Web application and BFF               | Next.js, React, HttpOnly cookies     | `apps/web`       |
| Mobile application                    | Flutter, Riverpod, Dio               | `apps/mobile`    |
| Shared contracts and configuration    | TypeScript, Zod                      | `packages`       |
| Schema, migrations, and local tooling | Prisma, Docker Compose, scripts      | `infrastructure` |

The default providers use local SMTP through Mailpit, local avatar storage, and console push delivery. Console push does not send notifications to phones. An optional S3-compatible storage adapter is available.

## Run locally

### Prerequisites

- Node.js 24.11 or later.
- pnpm 11.19.0, as declared in `package.json`.
- Docker with Docker Compose.
- For mobile development, Flutter compatible with Dart 3.13.4, an Android SDK, or macOS with Xcode for iOS.

### Set up the workspace

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres valkey mailpit
pnpm db:generate
pnpm -r --filter './packages/*' build
pnpm db:migrate
pnpm db:seed
```

On PowerShell, use `Copy-Item .env.example .env`. Copy the file only if `.env` does not already exist. The example configuration contains local development credentials. Replace them before any deployment.

Start each application in a separate terminal:

```sh
pnpm --filter @nodra/api dev
pnpm --filter @nodra/worker dev
pnpm --filter @nodra/web dev
```

| Local endpoint                | Address                            |
| ----------------------------- | ---------------------------------- |
| Web application               | http://localhost:3000              |
| REST API                      | http://localhost:4000/api/v1       |
| Interactive API documentation | http://localhost:4000/docs         |
| OpenAPI JSON                  | http://localhost:4000/docs-json    |
| API readiness                 | http://localhost:4000/health/ready |
| Worker readiness              | http://localhost:4100/health/ready |
| Mailpit inbox                 | http://localhost:8025              |

PostgreSQL uses port `5432`, Valkey uses `6379`, and Mailpit SMTP uses `1025`. The Compose services bind to loopback by default.

### Demo accounts

The seed creates a Northline organization, job roles, a group, services, and local accounts. Repeating the seed preserves existing records.

| Role        | Email                 | Development password |
| ----------- | --------------------- | -------------------- |
| Owner       | `owner@nodra.local`   | `Nodra-local-2026!`  |
| Participant | `worker1@nodra.local` | `Nodra-local-2026!`  |

Use these credentials only in local development.

### Run the mobile client

```sh
cd apps/mobile
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4000/api/v1
```

`10.0.2.2` reaches the host from the Android emulator. Use `localhost` for the iOS simulator. For a physical Android debug device, set `API_BIND_HOST=0.0.0.0`, use the host's private LAN address, and restrict port `4000` to the private network.

See the [mobile guide](docs/MOBILE_APP.md), [mobile README](apps/mobile/README.md), and [development guide](docs/DEVELOPMENT.md) for build scripts and platform requirements.

## Verify changes

Run the JavaScript checks from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start and migrate the dedicated test database before integration tests:

```sh
docker compose --profile test up -d postgres-test
pnpm db:migrate:test
pnpm test:integration
```

Integration tests use `TEST_DATABASE_URL` and remove their test data. Never point them at a database whose contents you need to preserve. The Compose test database is temporary and loses data when its container restarts.

The bootstrap verifier uses a separate temporary local database. It applies migrations, runs the seed twice, checks the compiled API, and removes only that database:

```sh
pnpm db:verify-bootstrap
```

For Flutter:

```sh
cd apps/mobile
flutter analyze
flutter test
```

See [testing](docs/TESTING.md) for evidence, optional transport tests, restore verification, and coverage limits.

## Current limits

- Full web DOM end-to-end coverage and physical mobile testing remain incomplete.
- An Android debug APK has been built and its signature verified. An iOS build remains unverified.
- Clients do not yet acquire device push tokens or deliver real mobile push notifications.
- Advanced notice targeting, organization customization, and sector presets remain partial or planned.
- CI is configured, but a successful remote run is not established by local test results.
- Production deployment, operational acceptance, and the full requirement audit remain open.

## Documentation

| Area                 | References                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Product and progress | [Product](docs/PRODUCT.md), [project status](PROJECT_STATE.md), [tasks](NEXT_TODOS.md), [requirements audit](docs/REQUIREMENTS_AUDIT.md) |
| Backend              | [Architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), [API](docs/API.md), [decisions](docs/DECISIONS.md)               |
| Access and security  | [Authentication and permissions](docs/AUTH_AND_PERMISSIONS.md), [multi-tenancy](docs/MULTI_TENANCY.md), [security](docs/SECURITY.md)     |
| Clients and design   | [Web](docs/WEB_APP.md), [mobile](docs/MOBILE_APP.md), [design system](docs/DESIGN_SYSTEM.md), [visual reference](docs/design.md)         |
| Operations           | [Development](docs/DEVELOPMENT.md), [testing](docs/TESTING.md), [deployment](docs/DEPLOYMENT.md), [notifications](docs/NOTIFICATIONS.md) |
| Project scope        | [Roadmap](docs/ROADMAP.md), [dependencies](docs/DEPENDENCIES.md)                                                                         |
