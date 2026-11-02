# Clean Node installation validation

Verified on 2026-11-02 against source commit `16e9c8c4a883d91d438485880b2f78c348e97679` on Windows. This validates the Node workspaces and local infrastructure, not full product acceptance.

## Isolation and toolchain

- Source came from `git archive HEAD` in a new temporary directory outside the working checkout.
- Node was v24.22.1. pnpm was exactly 11.19.0, the version declared by the project.
- The pnpm tarball came from the [official package registry](https://registry.npmjs.org/pnpm/11.19.0). Its SHA-512 matched the registry integrity metadata, and its package declared MIT.
- Installation used a new, separate store and `--frozen-lockfile`. It downloaded all 479 packages, reused none, and completed the permitted native installation scripts.
- The source lockfile stayed unchanged. The copied project had its own node_modules and no NODE_PATH pointing to the active application.
- Environment configuration came from .env.example. No private .env or application data was copied.

## Checks performed

| Check                                                | Result                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| pnpm install --frozen-lockfile with a separate store | Passed                                                               |
| pnpm db:generate                                     | Passed, Prisma Client 7.10.0                                         |
| pnpm -r --filter './packages/*' build                | Passed, all three shared packages                                    |
| pnpm lint                                            | Passed                                                               |
| pnpm typecheck                                       | Passed, shared packages, API, worker, and web                        |
| pnpm test                                            | Passed, two essential web unit tests                                 |
| pnpm build                                           | Passed, shared packages, API, worker, and Next production output     |
| pnpm db:migrate:test                                 | Passed, twelve migrations in the dedicated test database             |
| pnpm test:integration --hookTimeout=120000           | Passed, eleven PostgreSQL cases                                      |
| pnpm db:verify-bootstrap                             | Passed, twelve migrations, seed twice, fixture counts and API checks |
| pnpm test:web-vertical                               | Passed, actual HTTP and two BFF cookie sessions                      |
| pnpm licenses list --json                            | Passed with the fresh store indexes                                  |

Bootstrap created and removed only `nodra_verify_64f9152480a08303`. The HTTP verifier created and removed only `nodra_verify_54869f010893103f`. The HTTP flow covered invitations, persisted confirmations, service chat, per-user chat removal, and restoration on a new message. It did not render or drive the browser interface.

The original PostgreSQL, postgres-test, Valkey, and Mailpit containers were healthy after verification. Original web LAN, API LAN readiness, and worker loopback readiness returned HTTP 200. A nodemailer verify handshake against local Mailpit succeeded without sending mail. The active checkout, node_modules, and development data were not reinstalled, reset, or seeded.

## Environment issue found during verification

The first build attempt inherited NODE_ENV=development explicitly set by the verification shell. Next emitted its environment warning and failed prerendering /_global-error with a useContext error. Removing that shell override and repeating the build in the same copied installation succeeded. No application or dependency change was needed.

Leave NODE_ENV unset when invoking the normal build command so Next selects its build environment. On PowerShell, a process-level override can be removed with `Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue`. This does not change the development default stored in .env.

## Scope and remaining work

NOD-002 is complete for architecture, workspaces, and the documented local toolchain. NOD-003 is complete for the standard local services and application connections. Optional MinIO retains its previous fixture evidence and is not adopted as a production storage provider.

This run does not prove clean Flutter SDK installation, physical mobile execution, iOS builds, visual acceptance, cross-tab authentication behavior, binary redistribution compliance, or production readiness. Those limits remain in the corresponding tasks. The essential automated suite remains at sixteen cases; no CI workflow or new test suite was added.
