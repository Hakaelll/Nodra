# Import graph review, 5 November 2026

Source reviewed: `ab0309f`. This review addresses the historical section 257 observation that imports had not been checked for cycles.

A temporary local probe examined 89 TypeScript/TSX and 25 Dart production source files. It read 544 import/export references and resolved 325 distinct internal edges. The [recorded graph](2026-11-05-import-graph.json) includes those edges, the cycle and unresolved-reference results.

TypeScript import/export declarations and literal dynamic imports/requires were read with the installed TypeScript compiler AST. Relative references used the containing workspace's compiler configuration; local package names mapped to their source entry points. Dart line-level import/export/part directives resolved relative paths and the local package name. Searches found no conditional Dart directives, part files, TypeScript import-equals declarations or type-query imports requiring an additional traversal. The probe's cycle detector rejected a synthetic two-node cycle and accepted an acyclic graph.

No TypeScript cycle was found. Dart has one reciprocal import between `app_localizations.dart` and `app_localizations_es.dart`. The base localization file constructs the Spanish implementation, which extends the base class. These are Flutter localization outputs configured by `apps/mobile/l10n.yaml`; changing generated code would be overwritten. No other Dart cycle was found. No internal reference was unresolved and no computed dynamic import was encountered.

The scan excludes tests, build outputs, dependencies and non-TypeScript JavaScript assets. External package internals, Dart analyzer semantics, runtime dependency injection and imports added after this snapshot are outside this evidence. It does not claim a universal cycle-free repository.

Section 256's historical profile observation is also superseded by current source: AuthController delegates account reads, name changes and avatar processing to ProfileService, which is private to AuthModule. The existing architecture document describes that boundary. No application source, dependency, permanent test, emulator or infrastructure was changed by this review.
