# Query-plan review, 5 November 2026

Section 68 asks for analysis of important queries before adding indexes. This review captures SQL from real API routes and executes `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against isolated synthetic data. It analyzes query plans, not response time, throughput or production capacity.

## Fixture and method

PostgreSQL 17.11, fourteen migrations, four organizations with one shared owner. The fixture contains 10,000 services, positions, interests and notifications each, 100 pending assignments, four Memberships and 1,000 groups. Services span future dates; each tenant owns 2,500 services and 25 pending assignments. Directly inserted synthetic data was analyzed before querying. This is not an assignment creation test or a representative customer distribution.

Five HTTP reads exercised services with date bounds, dashboard attention, members, groups and notifications. A preload in the temporary API recorded SELECT statements and parameters through pg without replacing results. Each variant captured 26 calls and 19 distinct SQL/parameter pairs, then replayed those statements with EXPLAIN. The preload and full reports remain local; focused SQL and observed nodes are retained in [query-plans.json](2026-11-05-query-plans.json).

Baseline source: `90d67aa8dd33fd4a7d5cc77ed19eb5ada439a376`. The candidate adds `organizationId` to nested position and assignment predicates in `ServicesService.summary`. Fresh fixtures had equal entity counts. Five response summaries matched: services 10/39, dashboard 5/25, members 1/1, groups 10/250, notifications 10 items without a total field.

## Observed access paths

| Query | Observed plan |
| --- | --- |
| Services by organization/date | `Service_organizationId_startsAt_status_idx`, bitmap/index scans |
| Positions for the service page | `ServicePosition_serviceId_idx`, ten rows |
| Interests for those positions/user | `ServiceInterest_servicePositionId_userId_key`, ten rows |
| Notifications by user/organization | `Notification_userId_organizationId_createdAt_idx`, ten rows |
| Groups by organization/name | `Group_organizationId_name_key`; total count scanned the 1,000-row table |
| Membership checks/team | Sequential scans of four rows; no large-team conclusion |
| Assignments for a page | Sequential scan of 100 rows; existing indexes retained |
| Pending dashboard before | Both page/count scanned 10,000 positions and 100 assignments |
| Pending dashboard after | Both selected 25 tenant assignments and used 25 primary-key position lookups instead of the full position scan |

The outer service already constrained the organization and composite foreign keys preserve tenant relationships. Added predicates expose the same scope to nested query planning; they do not introduce a permission rule. Page/count/attention share this pending predicate. Draft handling, membership checks, lifecycle filters and the worker ownership predicate remain in place.

No index or migration was added. Existing indexes support the selective page reads observed here. Scans of small tables alone do not justify another index. Assignment/status indexing and production-scale tuning need representative data and an end-to-end workload.

## Verification and limits

API typecheck/build, global lint and thirteen PostgreSQL integration cases passed after the two additions. Both temporary HTTP scenarios returned populated results from all five routes, with matching summaries. The first probe incorrectly expected a page envelope from notifications; it was corrected to the documented array before the valid baseline. This was a probe error, not an application defect.

Guarded cleanup deleted the initial fixture `nodra_verify_8eb9f40ee0856fa5`, baseline `nodra_verify_4a5ebe9b64ec3ba4` and candidate `nodra_verify_a776c35fe3e0ce02`. Development data was not seeded/reset. No permanent test case, dependency, paid provider or CI workflow was added. Single-run plans do not establish every distribution, cache state, concurrency schedule or latency improvement. No speedup is claimed.
