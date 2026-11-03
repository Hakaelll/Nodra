# Organization customization implementation plan

Execute inline, without subagents or Computer Use, as requested by the owner.

**Goal:** Complete bootstrap section 61 with safe organization terminology and a limited accent configuration, preserving Nodra's identity.

**Architecture:** Extend existing OrganizationSettings and authenticated settings routes. Membership remains the authorization boundary. Public membership snapshots carry the resolved configuration for clients; administrative settings require OWNER/ADMIN. Existing serviceLabel remains the canonical singular label, without dropping data.

**Stack:** NestJS/Fastify, Prisma/PostgreSQL, Zod contracts, Next.js and Flutter. No new dependency or provider.

**Spec:** docs/BOOTSTRAP_PROMPT.md section 61; docs/CUSTOMIZATION.md; docs/design.md. The canonical light design and later owner instructions take precedence over skill presets.

## Backend delivery

- [x] Add strict singular/plural service and job-role labels, bounded plain text, and VIOLET/INDIGO/INK accent tokens to shared contracts. Arbitrary colors, CSS, HTML, fonts and layouts are not settings.
- [x] Add an additive migration for plural service label, singular/plural role labels and an enum accent. Keep existing serviceLabel data.
- [x] Map database columns to the public customization object; retain existing settings fields and feature behavior.
- [x] Add PATCH organizations/:org/settings/customization with a required expected snapshot. Recheck permission inside a serializable transaction; stale edits return 409, no-op saves do not create audit events, and accepted changes audit atomically without copying labels into metadata.
- [x] Include effective customization in membership snapshots so clients do not fetch administrative settings to render the organization.
- [x] Add one essential PostgreSQL regression for permission/tenant boundaries, validation, persistence, stale/concurrent saves and audit rollback. Do not restore removed suites or CI.
- [x] Run migration/bootstrap, relevant tests, contract verification, lint, types and builds. Update state and documentation.

Publish each verified delivery with a short English commit, as authorized.

## Client delivery

- [ ] Reuse the existing profile settings flow for an OWNER/ADMIN editor. Keep Configuration out of the sidebar. Use current controls and tokens with inline errors, preserved values and conflict recovery.
- [ ] Apply the selected token and terminology through organization context in web and Flutter. Preserve neutral route IDs, states, API vocabulary, logo and layout. Clear organization-specific configuration when changing account or organization.
- [ ] Keep the default appearance and labels identical for existing organizations. Offer a small set of indigo-family accents from the canonical design, with readable interaction states; no custom hex input.
- [ ] Update client documentation and run applicable checks. Visual acceptance and physical-device testing remain with the owner; do not claim these checks from static analysis.

The backend commit alone does not complete section 61. Keep its client work explicitly pending until it is implemented and verified.
