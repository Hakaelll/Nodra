# Spanish and English

Both clients offer Spanish and British English before sign-in and in the profile. Spanish remains the default. Switching language preserves the current session, route and form values. Web stores the choice in a validated `nodra_locale` cookie; Flutter uses a separate secure-storage key and serializes preference writes. An invalid preference falls back to Spanish.

## Message sources

`packages/shared/locales/en.json` contains 837 reviewed interface messages. Spanish source phrases are lookup keys. Templates use numbered placeholders such as `{value0}`. Web imports the catalog directly. `pnpm locales:generate` validates nonempty translations and matching placeholders, then generates `apps/mobile/lib/l10n/messages_en.dart`. Format the generated file with `dart format` from the mobile project. Flutter retains its ARB navigation catalog and standard localization delegates.

Use `useTranslation()` for controlled web copy and `tr(context, message)` for controlled Flutter copy. Apply organization terminology after translating the system phrase. Navigation uses its own labels so Home and the Start time field remain distinct. Dates use the selected locale and the organization's timezone; language never changes UTC instants or internal route/status identifiers.

Never pass names, service titles, chat messages, notice bodies or configured terminology through a translation helper. Translate system labels around interpolated data without translating the data itself. Notification responses include their domain-event `kind` so clients can distinguish generated selection copy from user-authored titles.

## Scope and verification

Translation covers navigation, auth and verification, onboarding, services and participation, calendars/date selection, people/invitations, roles/groups, notices, chat, profile/cropping, settings, errors, empty states, confirmations and accessible labels. Web metadata follows the saved language on initial rendering and after switching.

The API keeps stable Spanish error messages and neutral domain identifiers. Clients translate recognized system errors at presentation. Unknown server errors remain readable in their original language. Existing mail templates and previously stored notification bodies retain their original text; the UI language does not rewrite history or organization content. Documentation is not automatically translated.

One retained web regression checks literal translations, interpolation, unknown/prototype keys and custom terminology. Temporary React SSR and Flutter widget probes additionally checked catalog parity, English forms and preservation of user-entered names. These probes are development evidence rather than permanent end-to-end tests. Physical acceptance of the earlier APK does not certify the new language interface. See the dated validation record for commands and artifact evidence.
