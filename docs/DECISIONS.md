# Decisiones arquitectónicas

## ADR-014 — Contexto web en URL

Status: Accepted

Context: La navegación en memoria perdía sección y servicio al recargar y no admitía enlaces compartidos.

Decision: Usar /?org=<UUID>&view=<sección>&service=<UUID>, con create=service para creación. History/popstate sincronizado con React; org explícita nunca hace fallback a otro tenant. UUID es identidad estable, independiente del slug editable.

Alternatives: /org/:slug/... con rutas App Router; estado sólo en memoria.

Consequences: Recarga, enlaces y Atrás/Adelante conservan contexto sin duplicar layouts. Los filtros siguen locales; llevarlos a URL queda pendiente. Los parámetros no otorgan permisos. Invitaciones permanecen en fragment para no enviarse en URL al servidor.

Fecha: 21/09/2026. Accepted describe decisiones del repositorio, no verificación de todos sus componentes.

## ADR-001 — Modular monolith

Status: Accepted

Context: Necesidad de transacciones y evolución con un equipo pequeño.

Decision: Módulos Nest dentro de una API y worker separado del mismo código.

Alternatives: Microservicios y funciones remotas.

Consequences: Menor coste operativo; disciplina de límites internos.

## ADR-002 — PostgreSQL

Status: Accepted

Context: Datos relacionales y concurrencia de capacidad/invitaciones.

Decision: PostgreSQL local con constraints y transacciones serializables.

Alternatives: SQLite y bases documentales.

Consequences: Requiere servicio local; integridad protegida en DB.

## ADR-003 — Prisma

Status: Accepted

Context: Esquema y migraciones mantenibles en TypeScript.

Decision: Prisma con adapter pg; SQL adicional para invariantes.

Alternatives: SQL manual completo y otros ORM.

Consequences: Revisar SQL generado y mantener constraints fuera del modelo declarativo.

## ADR-004 — REST/OpenAPI

Status: Accepted

Context: Clientes web y móvil independientes.

Decision: API /api/v1 con JSON y Swagger.

Alternatives: GraphQL y RPC exclusivo de TypeScript.

Consequences: Contratos accesibles a Dart; completar aún esquemas de respuesta.

## ADR-005 — Flutter

Status: Accepted

Context: Cliente Android/iOS con código compartido.

Decision: Flutter, Riverpod, Dio, GoRouter y secure storage.

Alternatives: Dos apps nativas o webview.

Consequences: Toolchains móviles requeridas; no confundir tests de widgets con build nativo.

## ADR-006 — Next.js

Status: Accepted

Context: Web operativa y protección de tokens en navegador.

Decision: Next App Router y BFF con cookies HttpOnly.

Alternatives: SPA sin BFF.

Consequences: Añade proceso web; completar rutas profundas.

## ADR-007 — NestJS/Fastify

Status: Accepted

Context: Reglas de dominio estructuradas y validación.

Decision: Nest como composición, Fastify como servidor.

Alternatives: Servidor ad hoc.

Consequences: Decoradores necesitan configuración explícita; servicios autorizan transacciones.

## ADR-008 — Valkey

Status: Accepted

Context: Colas locales sin SaaS obligatorio.

Decision: Valkey compatible con protocolo Redis para BullMQ.

Alternatives: Redis alojado y colas comerciales.

Consequences: Persistencia y recuperación de jobs deben validarse.

## ADR-009 — BullMQ

Status: Accepted

Context: Entrega asíncrona con reintentos.

Decision: Outbox PostgreSQL alimenta BullMQ.

Alternatives: SMTP dentro de request o bus distribuido.

Consequences: API no depende de SMTP; reconciliación de cola pendiente.

## ADR-010 — Multi-tenancy

Status: Accepted

Context: Una persona participa en varias organizaciones.

Decision: Membership por User/Organization y Policy en servidor.

Alternatives: Base por tenant o organizationId confiado al cliente.

Consequences: Toda consulta privada exige scope; tests deben cubrir cruces.

## ADR-011 — Provider abstractions

Status: Accepted

Context: Evitar acoplamiento con proveedores externos.

Decision: MailProvider, PushNotificationProvider y ObjectStorageProvider, con transporte local y filesystem predeterminados; adapter S3 opcional para almacenamiento.

Alternatives: SDK comercial directo en dominio.

Consequences: Adapters locales actuales; contratos no prueban entrega real.

## ADR-012 — Zero-cost infrastructure during MVP

Status: Accepted

Context: Restricción explícita del propietario.

Decision: PostgreSQL/Valkey locales, Mailpit, ConsolePushProvider, auth interna y logs locales. Filesystem es el almacenamiento predeterminado de fotos; S3/MinIO local es adapter y fixture opcional, no una adopción productiva del upstream archivado.

Alternatives: Servicios gestionados, trials o créditos.

Consequences: Sin cuentas externas necesarias. El fixture MinIO advierte upstream archivado y no es default productivo; evaluar reemplazo mantenido al abordar documentos.

## ADR-013 — Referencia visual clara

Status: Accepted

Context: El propietario sustituyó la referencia oscura por Stripe.

Decision: docs/design.md clara prevalece sobre la referencia oscura; Inter Tight, navy/índigo y navegación inferior móvil. Las instrucciones posteriores del propietario prevalecen sobre los radios de 4 px de la referencia: controles suaves, lateral compacto inspirado en Codex y estados sin burbujas genéricas, según DESIGN_SYSTEM.md.

Alternatives: Mantener tema oscuro inicial.

Consequences: Preservar documento oscuro como historial; no confundir revisión con aprobación.
