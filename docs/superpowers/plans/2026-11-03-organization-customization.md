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

- [x] Reuse the web profile settings flow for an OWNER/ADMIN editor with existing controls, visible errors, preserved values and conflict recovery. Keep Configuration out of the sidebar.
- [x] Apply terminology and bounded accent tokens through web organization context. Preserve route IDs, states, permission roles and user content. Restore owned CSS tokens when leaving the account/organization context.
- [x] Retain the default VIOLET accent and provide three controlled indigo-family options. Measure text contrast and allow long labels without widening the mobile navigation. No free hex input.
- [ ] Consume terminology and accent in Flutter session/theme/screens, preserving context isolation, neutral route IDs and semantic colors. The web remains the administrative editor.
- [x] Document and run the applicable web checks; static React markup and token checks are evidence only for their own scope.

Flutter delivery and owner visual acceptance remain pending. Do not claim browser interaction, effects cleanup or physical-device verification from lint, static rendering or builds. Section 61 remains open.
