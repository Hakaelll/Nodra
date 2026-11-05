# Verified registration, 5 November 2026

The owner chose email verification before first access. Registration now returns 201 with only `{ok:true}`, including duplicate completed/inactive accounts, and creates no session. Completed/inactive accounts remain unchanged. Pending retries replace the unverified registration and invalidate old links transactionally. New verification requires its link and the chosen password; login, refresh and authenticated requests reject pending accounts. The migration defaults existing accounts to non-pending.

## Observed checks

- The existing registration integration first failed against the old behavior because registration returned a session. Its first infrastructure attempt could not reach the stopped test database; that attempt is not the functional reproduction.
- All thirteen retained PostgreSQL integrations passed. The registration case was then extended and rerun successfully for concurrent retries, a single pending link, rejection before verification, missing/wrong password, replay, completed/inactive duplicates and legacy access. A subsequent assertion also verified that a completed account's updatedAt remains unchanged.
- Lint, workspace types, Node builds, four web tests, Flutter analysis and three retained Flutter tests passed. Flutter analysis took 181.4 seconds; the lack of interim output was not treated as termination.
- A temporary widget probe drove AuthScreen through register, generic mail feedback, link/password entry and verification success with intercepted Dio. Only register and verify calls occurred. Its first finder incorrectly searched the base widget's exact runtime type; using a predicate for NodraTextField's superclass fixed the probe. It passed and was removed from the permanent suite. This is not a physical test of the changed signup flow.
- API contract verification passed: 69 documented/controller operations, 60 protected operations, three parser boundaries.
- Empty bootstrap applied fifteen migrations and seeded twice in `nodra_verify_85dedca3f4a27a66`; the fixture was removed.
- HTTP/BFF verification in `nodra_verify_06df1d76a25b99e1` confirmed generic registration without cookies, rejected early login, verified the encrypted outbox token and password, then logged in with cookies and completed the invitation/service/confirmation/chat/removal vertical. Both cookie sessions and shared refresh remained valid. The fixture was removed.
- Two failed-run accounts were identified by exact IDs/emails, checked for zero Memberships and removed only from local nodra_test with their sessions/actions. The test helper now records its fixture ID before response-shape assertions.
- The fifteenth migration was applied to development without reset or seed. The identified API process was restarted. Web LAN, API LAN readiness and worker readiness returned 200.

## Delivery limits

The owner previously tested APK `d7d6ce69080a71919a9a822463f563debf4951a98b0a0cc199a095900d2a467a` on a phone and reported persistent session, services and chat working. This closes the earlier native acceptance barrier. The signup change is newer; a new APK will be compiled with the requested English delivery. No emulator was reinstalled, no paid service activated and no permanent case added beyond the existing twenty. The temporary APK download server was stopped after the owner's test. Production providers, exact constant-time responses and iOS execution are not claimed.
