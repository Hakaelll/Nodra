# Verified registration implementation plan

The owner chose email verification before first access on 5 November 2026. This replaces the previous registration flow that returned a session immediately. Existing accounts retain access. English translation is the next requested delivery, covering web and Flutter.

Use the existing Auth module, encrypted AuthAction outbox, Mailpit, Zod contracts and client controls. Add a registrationPending flag defaulting to false for existing accounts; only newly registered accounts start pending. Registration returns the same `{ok:true}` response for available, pending, existing and inactive email addresses. Pending retries replace the unverified credentials and invalidate previous links within a serializable transaction. Completed accounts are never modified by registration. A verification link for a pending registration must also match its chosen password, preventing activation of an unsolicited registration with attacker-known credentials. Verification consumes the token and clears the gate atomically; login, refresh and authenticated requests reject pending accounts. Existing optional email-verification links remain compatible.

- [x] Extend the retained authentication integration coverage before implementing the gate. Keep the permanent suite count unchanged.
- [x] Add the backward-compatible migration, registration/verification behavior and documented OpenAPI responses. Handle concurrent registration without an email-dependent conflict response.
- [x] Update web registration success and verification password entry without creating cookies or triggering authenticated account reads before verification.
- [x] Separate Flutter registration from login; provide link/password verification while signed out and preserve the existing profile verification flow.
- [x] Update HTTP fixtures, seed/bootstrap expectations and documentation. Verify migrations on isolated databases, contracts, lint, types, essential tests, builds and native compilation where affected.
- [x] Deploy the coherent API/web change locally, publish a new APK, remove the generated caches and record the owner's earlier native acceptance with its original APK hash.
- [x] Implement English using the clients' existing localization structure and explicit locale selection; preserve user/organization-authored content and the approved visual direction.

No paid provider, external mail account, new production dependency, emulator, Computer Use, subagent or GitHub CI is needed. API changes must not expose registration existence through response status or body. Exact constant-time networking is not promised. Repeated generic registration requests can issue only new verification mail for pending accounts; the existing auth rate limiter remains active.
