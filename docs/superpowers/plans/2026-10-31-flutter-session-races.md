# Flutter session race correction

The retained essential test suite reproduces two failures: a refresh started for Alice finishes after logout and Bob's login, restoring Alice's credentials and visible session; two organization selections finish secure-storage writes out of order and restore the earlier choice.

## Design

NodraApi owns a session generation. Authentication and clear advance it. Requests capture it and reject late success or 401 responses instead of retrying an old request with a new account's credentials. Refresh remains shared only within its generation. Credential and organization-preference writes are serialized and skip obsolete generations, so a delayed write or delete cannot become the last persisted value for another account.

SessionController owns operation order for asynchronous loads and selections. Only the current operation may publish state. Organization-selection writes are serialized, and profile reloads wait for pending selection writes before resolving saved context. Logout clears local state and credentials before remote revocation. Remote revocation is best effort after local logout; unavailable network does not retain a local signed-in session. Backend sessions still expire normally if remote revocation cannot be delivered.

## Verification and delivery

- Keep the two deterministic regression tests that already fail for the actual races, alongside the existing offline recovery widget test. These are essential security checks, bringing the total suite to fifteen rather than restoring removed feature suites.
- Verify a late old refresh cannot replace either Bob's visible session or persisted credentials, and delayed selection writes keep the latest organization both in state and storage.
- Run Flutter analyze and tests, build the debug APK, and document the physical-device and iOS limits.
- Preserve Membership authorization in the backend and session-watching providers. No new dependencies, CI workflow, paid service, Computer Use, or subagents.
- Commit briefly in English and push the verified change.
