# Organization details editing

Scope: complete correction of an existing organization's name and IANA time zone. Keep the current light design, profile entry point, and backend Membership authorization. Logo, terminology, and accent controls remain separate work under CUSTOMIZATION.

## Contract and authorization

PATCH /api/v1/organizations/:org accepts name, timezone, and expected={name,timezone}. Reuse the creation limits and IANA validation without applying a default to an omitted update field. OWNER and ADMIN only, through Policy settings permission inside the Serializable transaction. Reject a stale expected pair with 409. Update the organization and write ORGANIZATION_UPDATED atomically. Do not change slug or stored UTC service instants. No schema migration or provider is needed.

## Delivery

1. Add the shared strict update schema, API method, documented response, and transactional service method.
2. Add a focused organization-details form to the existing profile Configuration view for OWNER/ADMIN. Reuse Input, Button, Card, inline validation, pending guard, and existing refresh callback. Preserve input on failure and distinguish a saved write from a failed subsequent refresh.
3. Manually exercise the compiled API on the dedicated local test database with owner, admin, coordinator, member, and foreign contexts. Verify validation, stale writes, audit identity, unchanged UTC service timestamps, and rejected operations without writes. Keep the thirteen essential automated tests unchanged.
4. Run applicable lint, typechecks, essential tests, and API/web builds. Update state and affected documentation, commit briefly in English, and push.

The owner has already requested autonomous execution without design confirmation or Computer Use. No new dependencies, paid services, screenshots, or visual acceptance claims.
