# Bootstrap validation, 3 November 2026

Source commit: `31ced95b27e86973042f6affa0a96f09624f319c`. These checks validate the current implementation. They do not close the complete prompt or certify production readiness.

## Results

| Check                                         | Observed result                                                                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                   | Passed with no warnings allowed                                                                                                                |
| `pnpm typecheck`                              | Passed for the shared packages, API, worker and web, including the session coordinator                                                         |
| `pnpm test`                                   | Four essential web tests passed                                                                                                                |
| `pnpm test:integration --hookTimeout=120000`  | Thirteen PostgreSQL integration cases passed                                                                                                   |
| `pnpm build`                                  | All Node workspaces built; Next production pages and standalone assets prepared                                                                |
| `flutter analyze --no-pub` in `apps/mobile`   | No issues                                                                                                                                      |
| `flutter test --no-pub` in `apps/mobile`      | Three essential mobile tests passed                                                                                                            |
| `pnpm verify:api-contract`                    | 69 controller/documented operations, 60 protected operations and three parser boundaries verified                                              |
| `docker compose config --quiet`               | Passed                                                                                                                                         |
| Existing Compose containers                   | PostgreSQL, postgres-test, Valkey and Mailpit healthy                                                                                          |
| `prisma validate` and `prisma migrate status` | Schema valid; all fourteen migrations applied to the existing development database                                                             |
| `pnpm db:verify-bootstrap`                    | Fourteen migrations applied to a new database; seed ran twice without duplicates; counts, login and service reads passed                       |
| `pnpm test:web-vertical`                      | Real HTTP/BFF flow passed with two cookie sessions, invitation, persisted confirmation, service chat, removal/recovery and coordinated refresh |
| `pnpm deps:inventory`                         | 477 reachable installed packages; no missing required dependency; 152 missing optional references                                              |
| Documentation inventory                       | All seventeen required documents present; 108 local links in 49 tracked Markdown files resolve                                                 |
| Prompt review inventory                       | 291 distinct section entries, no missing or duplicate section numbers                                                                          |
| GitHub CI                                     | No tracked workflow, as requested by the owner                                                                                                 |

The retained suite totals twenty cases. No tests or CI workflows were added for this review. The HTTP verifier does not render a browser or drive DOM interactions.

The bootstrap created and removed only `nodra_verify_01726ac5d80cca0c`. The HTTP verifier created and removed only `nodra_verify_c9ff207f6e279efc`. Neither reset nor seeded the owner's development database.

## Existing Android artifact

The current mobile source has no changes since the previously verified Android build at `b8c9459a309539a05d77f338354b654048b490b1`. Its existing debug APK still has SHA-256 `2368f02194444b10b076da3bac0f1de187af165d43673c7280f9d52727355940`. This review checked the source diff and artifact hash; it did not rebuild, install or run the APK. The earlier build and signature evidence remains in TESTING.

## Environment findings

The first web test invocation failed before loading tests because the filesystem sandbox rejected Vitest cache renames. The same command passed with the required cache access; no tests were skipped or weakened.

Flutter analysis was initially invoked from the repository root. That command was stopped and the analyzer and tests were run successfully from `apps/mobile`. The root invocation is not counted as a successful check.

Vite reports a future configuration-loader warning. The bootstrap also emitted a pg deprecation warning about overlapping queries. Both commands completed successfully; neither warning was suppressed or fixed by upgrading dependencies.

Dependency metadata has the previously documented undeclared `seq-queue` license and Sharp native binary license considerations. The local inventory is not a vulnerability scan or redistribution/legal certification. Dependency declarations and lockfiles are unchanged since the isolated clean-install validation; only package scripts changed.

## Remaining prompt discrepancy

Section 182 explicitly requests reusable web components. Textarea, Select, Checkbox, Dropdown, DataTable, SectionHeader and OrganizationSwitcher still have duplicated or screen-local markup. NOD-025 records their consolidation using the current design, styles and behavior. Existing dialog, status and inline feedback behavior must remain consistent with the owner's later instructions.

Other limits remain explicit: full DOM end-to-end coverage, physical mobile use, an iOS build and the owner's visual acceptance are unverified. Availability, advanced notice targets, custom fields, presets and remote push retain the future scope allowed by the original prompt. Inventory coverage alone does not prove implementation of all sections.
