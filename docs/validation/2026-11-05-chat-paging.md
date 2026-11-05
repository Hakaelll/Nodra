# Chat paging correction, 5 November 2026

Web polling previously assigned `messagePage = 1` after an older page had loaded. With more than 100 messages, the next request could repeatedly fetch page 2 instead of continuing to page 3. A temporary check executing the actual component callback reproduced the failure before the change: expected oldest loaded page 2, received 1 after polling.

The web now retains the highest loaded history page until the conversation changes. Message responses and send completion belong to a conversation generation; abandoned requests cannot populate another conversation, mark it read or clear its draft. A late deletion cannot close a newly selected conversation. The workspace also keys chat state by account and organization. Message ordering remains chronological, with deduplication by ID.

Both clients previously requested only the first 100 conversations. Web and Flutter now offer previous/next controls, poll the selected page and return to a valid page if hiding conversations empties the last one. Only the selected page is fetched; polling does not download all pages. The web refreshes list metadata immediately after hiding a chat. Flutter resets history when opening a conversation and prevents late older responses from decreasing the loaded page counter.

## Verification

- Global lint, web typecheck/production build and the four retained web tests passed.
- Flutter analysis and the three retained session tests passed. A temporary widget check opened page 2 of 110 conversations, displayed `Chat100`, advanced its four-second timer and confirmed that polling requested page 2 again.
- Actual web callback checks loaded pages 1, 2, polling page 1, then page 3: 130 distinct messages, oldest `000`, newest `129`. They also checked stale message/list results, page clamping and late deletion after selection changed. These checks use extracted callbacks and controlled state/network boundaries, not a browser DOM.
- A real HTTP/PostgreSQL fixture returned 110 distinct conversations in pages of 100/10 and 130 distinct messages in pages of 50/50/30, covering `Message0` through `Message129`. Hiding the ten last-page entries left total=100 and page 2 empty, the condition handled by the clients' page clamping. Records were inserted directly into a synthetic fixture; this is paging verification, not a chat creation-flow test.
- The first fixture cleanup sent ten hide requests concurrently and received a documented serializable-conflict 409. The probe was corrected to retire them sequentially, matching individual UI actions; the server was not changed to suppress that conflict. Both fixture databases, `nodra_verify_464a5d895a42ee18` and `nodra_verify_ebe096a4e9e983d1`, were removed.
- Android debug compilation passed in 108.6 seconds. APK SHA-256: `d7d6ce69080a71919a9a822463f563debf4951a98b0a0cc199a095900d2a467a`.

The permanent suite remains twenty cases. The temporary scripts/widget check are excluded from Git and are not commands available in a fresh clone. Backend source, contracts, schema and migrations did not change; the thirteen backend cases were not repeated for this client-only change. No new dependency, provider or CI workflow was added.

The emulator remains uninstalled as requested. The earlier native startup record applies to the previous APK hash; the newly compiled APK was not run on an emulator or physical phone. Full browser interaction and visual acceptance remain unverified. This correction does not replace offset pagination with a cursor or claim an exhaustive concurrency test.
