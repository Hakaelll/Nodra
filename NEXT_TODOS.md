# Próximas tareas de Nodra

Actualizado: 31/10/2026. El objetivo bootstrap sigue activo. REVIEW no significa DONE; se conservan todos los IDs y estados anteriores.

## Prioridad de continuidad

1. NOD-020: primer pase individual §0–290 completo; corregir discrepancias y verificar requisitos faltantes sin dar por completado el prompt por pruebas parciales.
2. NOD-019/008: ampliar cobertura de acciones AuditEvent y permisos (§63); cancelaciones por lote y gestión JobRole API/web/Flutter implementadas. E2E web y aceptación siguen pendientes.
3. NOD-014/015/017/022: completar pruebas de clientes y cambios de contexto; mantener aceptación visual a cargo del propietario, sin Computer Use ni subagentes.
4. NOD-013/016/020: adquisición push, build iOS y prueba física siguen sin demostrar. Android debug compilado y firma verificada el 02/10; SDK/JDK locales instalados. iOS requiere host compatible. No contratar servicios.

Resumen vigente en [PROJECT_STATE](PROJECT_STATE.md), evidencia detallada en [auditoría](docs/REQUIREMENTS_AUDIT.md). [Historial íntegro al 30/09](docs/history/NEXT_TODOS_2026_09_30.md) conserva notas de avance anteriores y los estados fechados. Las notas históricas de las tareas no sustituyen al resumen vigente.

## NOD-001 — Inspección del repositorio

Descripción: inspección de archivos, Git, instrucciones, prompt, diseño y herramientas.
Prioridad: P0
Estado: DONE
Dependencias: ninguna.
Objetivo: conocer el punto de partida.
Criterios de aceptación: inventario real y limitaciones registradas.
Archivos relacionados: PROJECT_STATE.md, docs/BOOTSTRAP_PROMPT.md, docs/design.md.
Tests requeridos: consultas de versiones y estado Git (realizadas).
Notas técnicas: repositorio vacío; sin Docker ni Flutter.

## NOD-002 — Arquitectura y monorepo

Descripción: definir límites, herramientas, contratos y decisiones.
Prioridad: P0
Estado: IN_PROGRESS
Dependencias: NOD-001.
Objetivo: base mantenible de coste cero.
Criterios de aceptación: workspaces y documentación coherentes.
Archivos relacionados: package.json, apps, packages, docs.
Tests requeridos: instalación, typecheck.
Notas técnicas: monorepo y documentación inicial creados; 13 ADRs registrados. Pendiente auditoría final de versiones/licencias y coherencia con implementación. Priorizar vertical; no implementar roadmap futuro.

## Plan detallado NOD-003 a NOD-020

Estados conservadores: REVIEW significa implementación pendiente de comprobación adicional, no DONE.

## NOD-003 — Development infrastructure

Descripción: Arranque local de PostgreSQL, Valkey, Mailpit y storage opcional.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-002.

Objetivo: Arranque local de PostgreSQL, Valkey, Mailpit y storage opcional.

Criterios de aceptación: Health de cada servicio y conexiones desde API/worker; instrucciones reproducibles.

Archivos relacionados: docker-compose.yml, infrastructure.

Tests requeridos: Compose config/up/health; PostgreSQL real.

Notas técnicas: PostgreSQL fixture persistente operativo. Docker Desktop 29.8.0 y Compose v5.5.1 validaron Valkey 8.1, Mailpit v1.31.1 y postgres-test 17 healthy. El PostgreSQL principal de Compose 17 también arrancó healthy en 5432 con volumen propio: cuatro migraciones aplicadas, seed repetido y bootstrap aislado aprobado. El fixture persistente de 5433 se conserva. MinIO opcional se construyó, arrancó healthy y respondió 200 en health/live. El adapter S3 opcional pasó una integración real con bucket efímero; el upstream archivado no se propone para producción.

## NOD-004 — Backend foundation

Descripción: API Nest/Fastify con Prisma, configuración, logs y contratos.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-002, NOD-003.

Objetivo: API Nest/Fastify con Prisma, configuración, logs y contratos.

Criterios de aceptación: Health/ready, errores seguros, validación y OpenAPI completo de request/response.

Archivos relacionados: apps/api, packages/config, docs/API.md.

Tests requeridos: Typecheck, build, integración y contrato OpenAPI.

Notas técnicas: Auth, catálogo, organizaciones y servicios documentan cuerpos/respuestas; /docs-json contrastado con payloads reales (20 tests de integración). Health/rate limit documentados y bloqueo auth real probado; 24 tests de integración pasan. Pendiente auditoría exhaustiva de errores y validación estructural OpenAPI. Respond idempotente devuelve estructura estable.

## NOD-005 — Auth

Descripción: Registro, login, refresh, logout y password security.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-004.

Objetivo: Registro, login, refresh, logout y password security.

Criterios de aceptación: Rotación/revocación real, contraseñas hasheadas, errores no enumeradores y clientes compatibles.

Archivos relacionados: apps/api/src/auth, docs/AUTH_AND_PERMISSIONS.md.

Tests requeridos: Unitarios, integración refresh y pruebas de password/logout.

Notas técnicas: Flujo implementado; integración PostgreSQL verifica rotación/reuso secuencial y concurrente, revocación de la familia y de todos los tokens tras cambiar contraseña, credencial nueva/vieja, logout idempotente limitado a su familia y sesiones expiradas/desactivadas. Login ejecuta Argon2id con hash ficticio para correo desconocido y entrega el mismo error público que credencial errónea/cuenta inactiva; email normalizado antes de validar. Recuperación y verificación de email tienen endpoints, formularios web, solicitudes Flutter, outbox cifrado, worker y tests PostgreSQL con MailProvider falso; prueba opt-in adicional entregó por SMTP real a Mailpit y consumió ambos enlaces. Registro duplicado aún devuelve 409 y revela existencia. Faltan apertura directa de enlaces en Flutter y E2E; estado REVIEW conservado.

## NOD-006 — Organizations and memberships

Descripción: Contexto multiorganización y PermissionRole por Membership.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-005.

Objetivo: Contexto multiorganización y PermissionRole por Membership.

Criterios de aceptación: Creación atómica owner, aislamiento y cambio de contexto sin datos previos; preservar último owner.

Archivos relacionados: apps/api/src/organizations, docs/MULTI_TENANCY.md.

Tests requeridos: Integración multi-tenant, cambio de organización web/móvil.

Notas técnicas: Creación/listado y edición de rol/estado con control optimista implementados. OWNER puede promover otro propietario; último owner protegido bajo carrera concurrente. Catorce tests integración pasan y editor revisado. Transferencia dedicada y suite E2E automatizada pendientes.

## NOD-007 — Invitations

Descripción: Crear, previsualizar, aceptar y revocar invitaciones.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-006.

Objetivo: Crear, previsualizar, aceptar y revocar invitaciones.

Criterios de aceptación: Caducidad, revocación, límites y uso concurrente; contexto claro en clientes.

Archivos relacionados: apps/api/src/organizations, apps/web/components/workspace.tsx.

Tests requeridos: Integración carrera de usos y flujos manuales.

Notas técnicas: Hash, preview autenticado, consumo transaccional/carrera de usos, expiración y revocación verificados en PostgreSQL. OWNER/ADMIN reciben enlace y código numérico de 12 cifras de la misma invitación; sólo se persisten hashes, y la prueba compite ambos canales por un único uso. Un caso confirma límite de dos usos reales, reintento de un miembro activo sin consumo adicional y rechazo 409 para Membership LEFT sin reactivación ni gasto de invitación. Tokens y códigos vencidos/revocados fallan tanto en preview como accept sin crear Membership. La web presenta enlace y código, incluso si la cuenta ya pertenece a otra organización, y cambia al tenant aceptado. Falta E2E de este flujo en clientes y dispositivos.

## NOD-008 — Job roles and groups

Descripción: Roles operativos y agrupaciones dentro del tenant.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-006.

Objetivo: Roles operativos y agrupaciones dentro del tenant.

Criterios de aceptación: Endpoints fundamentales autorizados, asociación Membership local y UI de edición.

Archivos relacionados: apps/api/src/catalog, apps/web/components/workspace.tsx.

Tests requeridos: Pruebas de permisos, membresía cruzada y edición.

Notas técnicas: Editor web de nombre y participantes implementado; búsqueda paginada de candidatos activos y catálogo de grupos paginado, autorización para coordinación y auditoría de altas/bajas. Pruebas PostgreSQL cubren tenant cruzado, participantes suspendidos, idempotencia, archivo, 101 grupos y total visible para MEMBER. Inspección visual desktop previa realizada; pendiente E2E automatizado y aceptación de la última revisión por el propietario.

## NOD-009 — Services

Descripción: Servicios, posiciones y lifecycle.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-008.

Objetivo: Servicios, posiciones y lifecycle.

Criterios de aceptación: Fechas válidas, publicación con posiciones, estados y visibilidad correctos.

Archivos relacionados: apps/api/src/services, packages/shared.

Tests requeridos: Unitarios de lifecycle y flujo PostgreSQL.

Notas técnicas: Prueba PostgreSQL recorre DRAFT→OPEN→SELECTION→CONFIRMATION→READY→IN_PROGRESS→COMPLETED; verifica asignación COMPLETED, salto inválido y terminalidad. Cancelación por API está probada con persistencia desde DRAFT, OPEN, SELECTION, CONFIRMATION, READY e IN_PROGRESS; cambia asignaciones activas a CANCELLED sin borrar Confirmation y genera DomainEvent al equipo. El listado coloca cancelados tras los demás antes de paginar, con prueba de cruce de página. Suite E2E web/dispositivos pendiente.

## NOD-010 — Interests

Descripción: Expresar o retirar interés sin reservar capacidad.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-009.

Objetivo: Expresar o retirar interés sin reservar capacidad.

Criterios de aceptación: Idempotencia, pertenencia activa y estados permitidos.

Archivos relacionados: apps/api/src/services, apps/web, apps/mobile.

Tests requeridos: Integración de interés y clientes.

Notas técnicas: Interés implementado. La suite PostgreSQL verifica retirada repetida sin duplicados, rechazo de selección tras retirada, reingreso en SELECTION, retirada en CONFIRMATION, denegación en DRAFT/CANCELLED y rechazo de Membership suspendida. Siguen pendientes pruebas de clientes para cerrar el estado REVIEW.

## NOD-011 — Assignments

Descripción: Selección autorizada y capacidad protegida.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-010.

Objetivo: Selección autorizada y capacidad protegida.

Criterios de aceptación: No sobreasignar ni cruzar tenants; interés válido; conflictos de horario explicables.

Archivos relacionados: apps/api/src/services, infrastructure/database/migrations.

Tests requeridos: Carreras PostgreSQL, permisos y conflictos.

Notas técnicas: Selección atómica con trigger de capacidad, interés requerido y no duplicidad probados en carrera PostgreSQL. La API advierte conflictos confirmados en otras organizaciones con `hasScheduleConflict` sin bloquear la selección ni revelar su identidad; solapamiento parcial detectado y turnos contiguos permitidos. Faltan más combinaciones de intervalo/conflicto y revisión de cancelación/reselección.

## NOD-012 — Confirmations

Descripción: Confirmar, declinar o cancelar conservando historial.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-011.

Objetivo: Confirmar, declinar o cancelar conservando historial.

Criterios de aceptación: Sólo destinatario responde; capacidad e historial coherentes tras cancelación.

Archivos relacionados: apps/api/src/services, apps/mobile/lib/screens/service.dart.

Tests requeridos: Integración de identidad/historial y test móvil.

Notas técnicas: Sólo el destinatario responde; declinar/cancelar conserva Confirmation y emite auditoría/DomainEvent. Si la persona cancela desde READY, el servicio vuelve a CONFIRMATION, se libera capacidad y puede seleccionarse a otra persona sin borrar la primera asignación. Integración PostgreSQL verifica historial y reemplazo con una plaza activa. Falta verificar el flujo en clientes y demás estados de cancelación.

## NOD-013 — Notification infrastructure

Descripción: Outbox, cola, worker y providers locales.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-012.

Objetivo: Outbox, cola, worker y providers locales.

Criterios de aceptación: Mailpit y console reciben eventos reales; retries y recuperación verificadas.

Archivos relacionados: apps/worker, apps/api/src/events.ts, docs/NOTIFICATIONS.md.

Tests requeridos: Integración Valkey/Mailpit, caída después de envío y reintentos.

Notas técnicas: Dispatcher reconcilia eventos sin procesar aunque queuedAt exista; preserva jobs/reintentos y recorre lotes con cursor. Entrega extraída a módulo comprobable. NotificationDelivery separa PUSH/EMAIL e impide repetir un canal confirmado cuando falla el otro; PostgreSQL verifica el reintento parcial. Pruebas opt-in usan Valkey/BullMQ y Mailpit reales: entrega normal, fallo TCP SMTP con job demorado, caída forzada/reinicio del proceso completo, desconexión temporal de red hacia Valkey, parada/reinicio del servidor Valkey aislado y fallo tras aceptación SMTP que demuestra duplicado de correo con Message-ID estable aunque Notification sea única. Suite con Valkey/Mailpit: 54 integraciones; Docker/MinIO omitidos en esta revisión. Comando retry de job fallido añadido. Registro protegido de dispositivos implementado. Pendientes conexión de clientes, push real y límite de entrega al menos una vez.

## NOD-014 — Web foundation

Descripción: Sesión segura, layout, contexto y diseño.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-005, NOD-006.

Objetivo: Sesión segura, layout, contexto y diseño.

Criterios de aceptación: URL refleja organización/sección; back/forward funciona; responsive y foco.

Archivos relacionados: apps/web/app, apps/web/components, docs/WEB_APP.md.

Tests requeridos: Build/typecheck, navegador y tests rutas.

Notas técnicas: BFF, tema claro y contexto org/view/service/create en URL implementados. Servicios comparte search/status/page; Inicio comparte filtro/día/página y Calendario página. La ruta valida valores y sección, conserva el listado al entrar/salir del detalle y recupera páginas fuera de rango con un control explícito. La búsqueda reemplaza la entrada de historial mientras se escribe; cambios de estado/pestaña/página permiten Atrás/Adelante. Dieciséis unitarios, lint/typecheck y build web se verifican en esta revisión; E2E automatizado y aceptación visual siguen pendientes.

## NOD-015 — Web operational flow

Descripción: Agenda, servicios, selección, respuestas y equipo.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-009, NOD-010, NOD-011, NOD-012, NOD-014.

Objetivo: Agenda, servicios, selección, respuestas y equipo.

Criterios de aceptación: Vertical completa con datos reales; agenda no limitada accidentalmente a primera página.

Archivos relacionados: apps/web/components, docs/WEB_APP.md.

Tests requeridos: Suite E2E web, estados vacíos/error y paginación.

Notas técnicas: Flujos implementados; resumen global paginado en backend y calendario filtrado antes de paginar. Tests PostgreSQL verifican más de 25 históricos, varias páginas futuras, permisos/pendientes propios y día de 23 horas. Portada/filtro revisados en navegador y móvil. Falta suite E2E automatizada completa.

## NOD-016 — Flutter foundation

Descripción: Riverpod, Dio, rutas, secure storage y organización.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-005, NOD-006.

Objetivo: Riverpod, Dio, rutas, secure storage y organización.

Criterios de aceptación: Sesión restaurada, refresh, cambio de tenant y errores offline; build nativo.

Archivos relacionados: apps/mobile/lib/core, apps/mobile/lib/main.dart.

Tests requeridos: Flutter analyze/test y compilación Android/iOS.

Notas técnicas: Flutter analyze y 27 tests pasan, incluidos widgets del código de invitación, inscripción y confirmación. El README móvil documenta comandos, entorno, arquitectura y límites de pruebas en teléfono. `flutter doctor -v` confirma Android SDK ausente en este equipo; iOS requiere macOS/Xcode. No se afirma compilación nativa ni uso en dispositivo.

## NOD-017 — Flutter service flow

Descripción: Servicios, interés y respuesta a asignación.

Prioridad: P0

Estado: REVIEW

Dependencias: NOD-012, NOD-016.

Objetivo: Servicios, interés y respuesta a asignación.

Criterios de aceptación: Flujo real contra API y navegación correcta en dispositivos.

Archivos relacionados: apps/mobile/lib/screens.

Tests requeridos: Prueba end-to-end en dispositivo y widgets.

Notas técnicas: Implementado en código; widgets prueban inscripción y confirmación desde el detalle con actualización visible. Falta verificación nativa completa y recorrido contra API real desde dispositivo.

## NOD-018 — Notices

Descripción: Avisos y acuse de lectura.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-006.

Objetivo: Avisos y acuse de lectura.

Criterios de aceptación: Publicar/listar/acuse idempotente; definir alcance de targeting.

Archivos relacionados: apps/api/src/catalog, apps/web, apps/mobile.

Tests requeridos: Integración acuse y visualización clientes.

Notas técnicas: Base verificada como difusión para todos los Membership activos; targeting por grupo queda diferido. Web y Flutter permiten listar/acuse idempotente; web permite publicar. OWNER/ADMIN/COORDINATOR despliegan nombres de quienes confirmaron, MEMBER sólo recibe su propio acuse. Prueba PostgreSQL verifica destinatarios, nombres y privacidad por rol; E2E de UI/dispositivo sigue pendiente.

## NOD-019 — Audit / security hardening

Descripción: Auditoría, límites y pruebas de aislamiento.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-004, NOD-012.

Objetivo: Auditoría, límites y pruebas de aislamiento.

Criterios de aceptación: Acciones sensibles trazables sin secretos, endpoints aislados y rate limit probado.

Archivos relacionados: apps/api/src/events.ts, apps/api/src/vertical.integration.test.ts, docs/SECURITY.md.

Tests requeridos: Tests por permiso/tenant, logs y revocación.

Notas técnicas: Auditoría y controles iniciales existen. Rate limit auth real probado; listado/detalle limitan identidades de asignaciones a las propias para MEMBER. Avisos difunden a toda la organización con acuses privados para MEMBER. La matriz pura role/permission 4×4 y los contratos de auth/UUID/éxito/429 en 38 rutas están cubiertos. La suite auth cubre refresh concurrente, logout idempotente, expiración, cuenta desactivada y revocación por cambio de contraseña. Falta completar auditoría por endpoint/tenant y sensibilidad de logs.

## NOD-020 — Final validation

Descripción: Verificar requisitos del prompt y cerrar documentación.

Prioridad: P0

Estado: IN_PROGRESS

Dependencias: NOD-003 a NOD-019, NOD-021.

Objetivo: Verificar requisitos del prompt y cerrar documentación.

Criterios de aceptación: Lint/typecheck/tests/build/migraciones/seed con evidencia; auditoría requisito por requisito y límites explícitos.

Archivos relacionados: README.md, docs, PROJECT_STATE.md, NEXT_TODOS.md.

Tests requeridos: Gates monorepo, Flutter, infraestructura y E2E.

Notas técnicas: 17 documentos requeridos ya creados. Una base local vacía recibió las migraciones vigentes; seed repetido sin duplicados y API real devolvió ready/login/organización/servicios esperados. El procedimiento está automatizado en `pnpm db:verify-bootstrap`, pasó dos veces en PostgreSQL local y una vez sobre PostgreSQL principal de Compose, y se añadió a CI tras el build; la ejecución remota de CI aún no se ha confirmado. Cada prueba elimina sólo la base temporal que creó y conserva desarrollo/test. Docker Compose validó PostgreSQL principal, Valkey, Mailpit, postgres-test y MinIO opcional; integraciones aisladas comprobaron BullMQ/SMTP y S3/MinIO con ruta real de avatar. No declarar objetivo completo: faltan recuperación del worker ante fallos, builds móviles nativos, E2E, inspección en segundo dispositivo y auditoría final requisito por requisito.

## NOD-021 — Revisión visual solicitada por el propietario

Descripción: aplicar UI UX Pro Max, hueyexe frontend skills, Emil y la skill universal/Impeccable al producto real.
Prioridad: P0
Estado: IN_PROGRESS
Dependencias: NOD-014, NOD-015.
Objetivo: interfaz operativa cuidada, sin decoración genérica, con navegación inferior móvil y animaciones fluidas.
Criterios de aceptación: rutas funcionales, diseño revisado en escritorio/móvil, teclado y reduce motion; validar barra inferior y ausencia de overflow.
Archivos relacionados: apps/web/components, apps/web/app/globals.css, docs/DESIGN_SYSTEM.md.
Tests requeridos: lint, typecheck, build, comprobación en navegador.
Notas técnicas: skills instaladas en C:/Users/yagol/.codex/skills. Referencia actual Stripe clara aplicada a web y paleta Flutter; docs/DESIGN_SYSTEM.md actualizado. Build Next y lint pasaron; Flutter analyze y 4 tests pasaron. Web clara revisada en escritorio y móvil; faltan hardware móvil y contenidos extremos. Deep links y resumen paginado de backend implementados y comprobados; ver NOD-014/015. Impeccable context falló por escritura de motor fuera del repo; se aplican guías directamente. No se afirma ejecución satisfactoria de detector ni critique formal. Se utilizan distill/adapt/operate y guías de Emil.

## Avance transversal 23/09/2026 — Diseño web y perfil

Los cambios pedidos de UI y perfil propio están implementados en código: navegación lateral/móvil, fotografía local con crop, edición de nombre/apellidos, imagen de fondo y movimiento. NOD-002/004/005 y los requisitos originales conservan su estado; no se marcan DONE por este avance. La comprobación visual final queda a cargo del propietario por petición expresa. ESLint, typecheck web/API, compilación contracts/API/worker, build Next, 12 tests unitarios, 35 de integración y smoke binario de perfil pasaron. Flutter no cambió. Pendientes los requisitos del bootstrap general y las verificaciones de infraestructura/hardware ya descritas.

Corrección de navegación solicitada: Configuración se retiró del lateral de escritorio y del panel Más móvil; queda accesible desde Perfil. Los controles web comparten radios suaves, botones primarios/secundarios diferenciados y estados de foco/hover/pulsación. El propietario revisará el resultado visual sin Computer Use; NOD-021 continúa IN_PROGRESS.

Nueva pasada NOD-021: geometría de controles y superficies más suave, jerarquía primario/secundario acentuada y capa exterior del panel Más para cierre táctil. Configuración conserva Perfil como destino activo, tiene retorno explícito y la cabecera móvil indica la pantalla actual. Lint, typecheck web, 16 unitarios y build Next pasaron; no se realizó inspección visual por petición del propietario. Sigue pendiente su aceptación visual y prueba en dispositivo.

NOD-019 continúa: la foto de perfil ahora se decodifica y recodifica en API, y una prueba rechaza una cabecera JPEG falsa con dimensiones aparentes 512 × 512. Pasaron 35 integraciones PostgreSQL, tsc API, ESLint dirigido y smoke BFF tras reiniciar API. La revisión de seguridad por endpoint/tenant y las comprobaciones de infraestructura siguen pendientes; el estado permanece IN_PROGRESS.

NOD-019 logging: ConsolePushProvider registra sólo eventId/recipientId, sin texto ni metadatos libres; test unitario de privacidad añadido. Pasan build/typecheck worker, ESLint dirigido, 13 unitarios y 35 de integración. Faltan auditoría de otros logs y transporte real Valkey/Mailpit.

NOD-019 matriz de rutas: 10 GET y 16 POST/PATCH de organización verifican 403 para no miembro y 401 sin sesión con entradas válidas; 37 integraciones PostgreSQL pasan. En ese momento faltaban referencias de recursos reales cruzados y permisos por rol en cada operación; no se dio por terminada la auditoría.

NOD-019 referencias reales y settings: 14 operaciones contra UUID existentes de otro tenant no leen ni alteran recursos. La matriz de ajustes detectó exposición a COORDINATOR/MEMBER; GET settings ahora exige permiso settings. 39 integraciones PostgreSQL, 13 unitarios, ESLint y build API pasan. Faltan combinaciones de rol para otras operaciones y revisión de auditoría/logs; mantener IN_PROGRESS.

## NOD-022 — Chat de equipo y de servicio

Descripción: conversaciones manuales y desde servicios confirmados, con lectura por participante.
Prioridad: P0
Estado: IN_PROGRESS
Dependencias: NOD-004, NOD-009, NOD-014, NOD-021.
Objetivo: chat sencillo, privado por Membership, utilizable en móvil y escritorio.
Criterios de aceptación: creación individual/grupo con nombre; chat de servicio con título heredado; mensajes cronológicos e idempotentes; contador de no leídos; acceso limitado a participantes; E2E en dispositivo y cliente móvil.
Archivos relacionados: apps/api/src/chats, apps/web/components/chat-screen.tsx, infrastructure/database, docs/API.md, docs/WEB_APP.md.
Tests requeridos: integración PostgreSQL, unitarios, lint, typecheck, build y recorrido de cliente.
Notas técnicas: backend/web/Flutter y nueve migraciones implementados. La burbuja de navegación cuenta conversaciones pendientes y cada chat conserva su contador de mensajes. La web usa polling local y refresca al volver al foco. Flutter tiene tests de widgets; E2E real en dispositivo, builds nativos y push de chat quedan pendientes; no marcar DONE.

Corrección 30/09, Chat: comprobado DELETE sin cuerpo mediante cliente/BFF y recorrido HTTP real. Regresión nueva para reintento tras refresh; ocho pruebas focalizadas y 33 unitarios actuales pasan, junto a lint afectado y typecheck web. La aceptación visual permanece a cargo del propietario; se conservan los estados e historial existentes.

## NOD-023 — Decisión sobre proveedores externos futuros

Descripción: decidir proveedores para push FCM/APNs, correo productivo, alojamiento y storage remoto cuando se autorice una fase posterior.
Prioridad: P3
Estado: BLOCKED
Dependencias: decisión explícita del propietario; NOD-013, NOD-020.
Objetivo: mantener desarrollo y ejecución local sin cuentas ni pagos obligatorios.
Criterios de aceptación: decisión registrada con alternativa gratuita/self-hosted, costes y cuentas; autorización explícita antes de activar un proveedor potencialmente de pago. No contratar servicios en este bootstrap.
Archivos relacionados: docs/ROADMAP.md, docs/DEPLOYMENT.md, docs/NOTIFICATIONS.md, docs/DECISIONS.md.
Tests requeridos: tras autorización, contratos de adapter y aislamiento; no ejecutar llamadas comerciales para desbloquear esta tarea.
Notas técnicas: Requires explicit owner decision about external provider. El bloqueo se limita a las integraciones externas futuras, no al pipeline local ni al objetivo bootstrap general.

Continuación 30/09 — NOD-021/020: detectada discrepancia de cancelados en Calendario. Hay estilos grises en clientes, pero Services.calendar excluye CANCELLED. Pendiente alinear consulta, permisos y regresiones sin reintroducir cancelados en próximos; la documentación ya distingue el estado real.

Resolución 30/09 — NOD-021/020: API mensual incluye CANCELLED como historial y conserva DRAFT oculto a MEMBER; próximos/dashboard no cambian. Regresión PostgreSQL comprueba cancelado para owner/member y aislamiento. Pasan 56 integraciones verticales, 35 unitarios, lint global, typecheck y build API. Los estilos grises existentes web/Flutter ya reciben los eventos; sin Computer Use ni aceptación visual. El hallazgo anterior queda resuelto en código.

30/09 — NOD-019/020: ApiErrors sanitiza mensajes de HttpException 5xx conservando estado; el log no incluye mensaje/stack. Cuatro regresiones verifican Error/HTTP 500/503 con canarios y validación 400 legible. Pasan 39 unitarios, 56 integraciones verticales, lint global y typecheck/build API. Auditoría individual §169–195 añadida; pendientes primitives completas, filtros role/group contextualizados y rendimiento medido. Sin Computer Use ni subagentes; objetivo activo.

30/09 — NOD-020/§196–225: treinta secciones contrastadas con esquema/Policy/Auth/Organizations/Fastify/Compose. DATA_MODEL documenta naming vigente; DEPLOYMENT completa dumps/snapshots/copia cifrada separada/restore aislado sin contratar. Pendientes: boundary de perfil en AuthController, health worker, licencias transitivas/imágenes y restore real. Checks de formato/IDs/enlaces; sin cambios runtime ni suites nuevas por documentación. Continuar §226–290; conservar estados/DONE.

## NOD-024 — Perfil web sin Membership activa

Descripción: acceso al perfil propio desde onboarding sin Membership ni datos de organización ficticios.
Prioridad: P1
Estado: REVIEW
Dependencias: NOD-014, NOD-021.
Objetivo: permitir consultar y editar nombre/apellidos/foto propios sin pertenecer a una organización, además de crear o aceptar invitaciones.
Criterios de aceptación: acceso Perfil desde onboarding; datos de cuenta reales sin rol/empresa/fecha de alta inventados; no consultar endpoints tenant sin org; editar/subir foto conserva sesión; regreso visible a crear/unirse; logout conserva confirmación central.
Archivos relacionados: apps/web/components/workspace.tsx, apps/web/components/profile.tsx, docs/WEB_APP.md, docs/DESIGN_SYSTEM.md.
Tests requeridos: contratos de perfil y typecheck/lint/build web; regresión de cliente sin Membership, sin solicitudes organization/undefined. No Computer Use; valoración visual del propietario.
Notas técnicas: reutilizar edición/recorte actuales; props de contexto deben ser opcionales sin inventar una organización. Auth/me ya funciona sin Membership. No crear un perfil paralelo que diverja del existente.

30/09 — NOD-020/§226–255: treinta secciones contrastadas; NOTIFICATIONS diseña NotificationPreference por Membership/canal/categoría con FKs, defaults y entrega SKIPPED futura sin tablas ficticias. NOD-024 TODO concreta acceso al perfil web sin Membership, actualmente ausente. JobRole tiene active pero no archivo API/UI. Formato/IDs/enlaces comprobados; sin runtime nuevo, Computer Use ni subagentes. Continuar §256–290 y resolver pendientes, objetivo activo.

30/09 — NOD-024/§248: onboarding web ofrece Mi perfil; URL ?view=profile sin org permite recarga/historial, regreso Volver y logout con diálogo central. Profile reutiliza edición/foto, omite contexto/actividad/settings tenant ausentes y no consulta notificaciones sin organizationId. Tres regresiones de renderizado estático/ruta, 42 unitarios totales, lint/typecheck web y build Next pasan; integración de perfil verifica cero Membership antes/después de editar/subir avatar, 56 integraciones pasan. Son pruebas SSR/API, no DOM ni recorte interactivo E2E; mantener REVIEW. Primera integración falló porque Docker estaba parado: recuperados cuatro contenedores saludables, once migraciones test tmpfs y procesos web/API/worker; datos de desarrollo conservados. Sin Computer Use ni subagentes.

30/09 — NOD-020/§256–290: primer pase individual completo, 291 entradas únicas verificadas. §276 valida puertos SMTP/Valkey enteros 1–65535 con 14 regresiones. §279 refuerza TEST_DATABASE_URL local dedicada sin parámetros de conexión ni entorno production; 15 regresiones de guard, 71 unitarios totales y 56 integraciones verticales pasan. No reset destructivo ni cambios en datos de desarrollo. NOD-020 sigue abierto: cobertura documental no equivale a entrega completa.

30/09 — NOD-008/019/020 (§63/239): API PATCH de JobRole permite edición/archivo/reactivación con Policy y filtro tenant, sin borrar posiciones históricas. SERVICE_PUBLISHED sustituye SERVICE_OPEN para nuevas publicaciones; transición de Membership a LEFT registra MEMBER_REMOVED. Regresión HTTP/PostgreSQL cubre permisos, IDs de otro tenant, cuerpo vacío/extra, historial, archivo/reactivación y acciones; OpenAPI tiene 62 operaciones con respuesta de éxito documentada. Pasan 57 integraciones verticales, 71 unitarios, lint global y typecheck/build API. Falta editor de roles web/Flutter y revisión de otros eventos de auditoría, incluida cancelación por lote. No se modifican registros de auditoría históricos. Objetivo activo.

30/09 — NOD-008/014/015/020 (§63/239): gestión de roles conectada a web y Flutter. Web: detalle de servicio muestra catálogo con edición inline de nombre/descripcion, archivo confirmado y reactivación; formularios de posición ocultan roles archivados y muestran alternativa cuando no quedan activos. Gestor se remonta por organización y evita escribir después de desmontarse. Flutter: Perfil ofrece Roles laborales sólo a OWNER/ADMIN/COORDINATOR; lista con menú, alta/edición, archivo confirmado y reactivación, errores/reintento. Cada escritura vuelve a comprobar contexto actual; editor abierto rechaza guardar si cambió el tenant. Backend sigue siendo la autoridad. Sin Computer Use ni revisión visual nueva; no se declara E2E DOM ni build nativo.

30/09 — Gestión de roles en clientes: lint global, typecheck web, 71 unitarios JS y build Next pasan. Flutter analyze --no-pub y 43 tests pasan; cuatro widgets nuevos prueban validación/reintento conservando campos, archivo con cancelación/confirmación/reactivación, miembro sin peticiones de gestión y editor abierto tras cambiar tenant. La web se verificó por compilación, no con E2E DOM; sin Computer Use ni build Android/iOS. Backend conserva la evidencia de 57 integraciones de la revisión anterior, sin repetir esa suite por estos cambios de clientes.

30/09 — NOD-019/020 (§63): cancelar un servicio registra ASSIGNMENT_CANCELLED para cada asignación previamente AWAITING_CONFIRMATION/CONFIRMED, dentro de la misma transacción Serializable que cambia estados, audita SERVICE_CANCELLED y crea el evento. Bulk createMany evita una consulta de auditoría por persona. DECLINED/CANCELLED/COMPLETED previos no se alteran ni reciben una cancelación nueva; tampoco otras posiciones de otro servicio. Matriz de seis estados y prueba concurrente comprueban actor/tenant/entidad/fecha, permisos rechazados sin auditoría, ausencia de duplicados e historial Confirmation intacto. No se añaden notificaciones por asignación: se conserva el evento de servicio existente para evitar avisos duplicados.

30/09 — Verificación de cancelaciones por lote: pasan 58/58 integraciones verticales PostgreSQL y 71/71 unitarios JS; lint global y typecheck/build API aprobados. API compilada recargada para la vista local. No se repiten builds/pruebas de clientes sin cambios en su código; no E2E visual ni hardware nuevo. Objetivo activo.

30/09 — NOD-004/020 (§210/256): ProfileService privado de AuthModule asume lectura/edición del perfil, generación de avatarUrl, validación/normalización JPEG y acceso a ObjectStorageProvider. AuthController sólo parsea DTO, obtiene identidad del AuthGuard, delega y compone las cabeceras HTTP del binario. No cambian rutas, contratos, permisos ni esquema; no se crea módulo vacío. Pasan 58 integraciones PostgreSQL (incluido perfil sin Membership, JPEG inválido/falso/válido y visibilidad tenant), 71 unitarios, lint global y typecheck/build API. Esto corrige el hallazgo concreto del controlador de perfil; no certifica todos los boundaries ni E2E/hardware.

02/10 — NOD-016/020: Java portable y Android SDK instalados en .local/android-toolchain; paquetes de SDK/NDK y licencias presentes, archives SHA-256 comprobados. Scripts PowerShell de preparación/build añadidos, sintaxis validada; wrapper Gradle fijado con checksum oficial y distribución local contrastada. Primer assembleDebug en curso; todavía no se declara APK aprobado ni ejecución física. iOS sigue requiriendo macOS/Xcode. No se repiten suites de aplicación por preparación del entorno.

02/10 — NOD-016/020 (§14/27): primer APK Android debug compilado correctamente en Windows (assembleDebug, 517,5 s). Artefacto: apps/mobile/build/app/outputs/flutter-apk/app-debug.apk, 174012663 bytes, SHA-256 2fc74af67d9c47e0e6eafb5db74b95084c61af5959fdaca40ff61572370dee7c. apksigner verify --verbose pasó con firma APK v2; aapt2 confirmó dev.nodra.nodra, versión 1.0.0/1, min SDK 24, target/compile SDK 36, MainActivity y ARM32/ARM64/x86_64. API_URL de build: http://192.168.1.133:4000/api/v1. Se añadió CMake 3.22.1 a preparación y comprobación del toolchain, tras su instalación automática durante Gradle. Las notas anteriores de SDK ausente/build pendiente son evidencia histórica, superada para Android debug por este resultado. No se declara instalación, funcionamiento en dispositivo, release, build iOS ni disponibilidad actual de la API LAN. NOD-016 y NOD-020 siguen abiertos.

02/10 — Reproducción incremental con build-android.ps1 definitivo: assembleDebug terminó en 32,0 s (exit 0); firma v2 verificada de nuevo. Artefacto final: 174012663 bytes, SHA-256 2fc74af67d9c47e0e6eafb5db74b95084c61af5959fdaca40ff61572370dee7c. Sintaxis de ambos scripts y enlaces locales de los nueve documentos editados comprobados. Estados NOD conservados (1 DONE, 13 IN_PROGRESS, 9 REVIEW, 1 BLOCKED).

02/10 — NOD-003/004/013/019/020 (§217): health del worker implementado en loopback (WORKER_HEALTH_PORT=4100; 0 para procesos de test). /health indica vida; /health/ready prueba SELECT 1, lectura de la cola en ambas conexiones Valkey y consumidor activo/no pausado. Sonda compartida con deadline 1500 ms evita consultas acumuladas si un driver no resuelve; respuestas genéricas/no-store y 503 al parar, sin datos privados. No comprueba SMTP/storage ni éxito de todos los trabajos. Seis regresiones health y siete de puerto llevan la suite JS a 84/84. Config compilada, API typecheck, worker typecheck/build y lint global pasan. Con PostgreSQL/Valkey/Mailpit reales, la integración de proceso demuestra readiness 200→503→200, liveness durante interrupción y entrega única tras reconexión; suite completa opt-in: 63 pruebas pasan y 2 opt-in omitidas. PostgreSQL test tmpfs recibió once migraciones tras arrancar los cuatro contenedores existentes, todos healthy; volumen de desarrollo conservado. No se repiten builds web/Flutter sin cambios en esos clientes. Los hallazgos históricos de health worker ausente quedan superados; estados NOD conservados y objetivo activo.

02/10 — Entorno local recuperado: desarrollo tenía los procesos web/API/worker detenidos y Docker sin contenedores corriendo. Arrancados los cuatro servicios existentes sin reset/seed; once migraciones de desarrollo detectadas sin pendientes. API PID 21948 (sesión 71148), worker actualizado PID 5332 (sesión 95627), Next dev sesión 98199. Comprobación HTTP posterior: web http://192.168.1.133:3000/ = 200; API LAN /health/ready = 200; worker http://127.0.0.1:4100/health/ready = 200. La consulta LAN es desde este ordenador, no desde un teléfono. Revalidar handles/puertos antes de cualquier reinicio futuro.

02/10 — NOD-003/019/020 (§219): nuevo db:verify-restore ejecuta simulacro de backup/restauración con datos sintéticos, bases propias y cola Valkey aislada. Pasó en run 490200dcb85013f9: 27 tablas con filas idénticas, constraints/índices/triggers/funciones/enums idénticos, archivo AES-256-GCM de 102622 bytes y corrupción rechazada; avatar binario conservado, login API, tenant ajeno 403, borradores ocultos, chat conservado y evento outbox repuesto. Restore más verificación 1368 ms, total 16589 ms; sólo mide este fixture pequeño. Informe .local/restore/490200dcb85013f9/report.json. Dos primeros intentos fallaron por datos sintéticos del chat no ajustados al modelo Prisma; corregidos a MANUAL y alta separada de participantes, sin alterar el modelo del producto. Comprobación posterior confirmó cero bases de los tres ensayos restantes. Guardas rechazan producción/host remoto/parámetros/puerto ajeno/nombres de desarrollo; errores no exponen credenciales. Suite JS 100/100 (16 guardas nuevas), lint global apps/packages y dirigido a scripts, sintaxis Node y formato pasan. No se repiten suites/builds de aplicaciones sin cambios en ellas. Web LAN/API LAN/worker readiness siguen 200 tras el simulacro. No es backup productivo: la clave de ensayo no se conserva; copias reales/offsite, retención, snapshots, custodia y prueba física siguen futuras. Estados NOD/DONE conservados, objetivo activo.

02/10 — NOD-018/019/020 (§52/76): destinatarios básicos de avisos implementados para ORGANIZATION/USERS. Duodécima migración añade Notice.audienceVersion y NoticeRecipient con FKs compuestas; legacy 0 conserva difusión sin reconstruir audiencias ficticias. Publicación nueva resuelve Membership ACTIVE/User activo y persiste snapshot/auditoría/outbox en la misma transacción Serializable. MEMBER y pendientes propios filtran audiencia antes de paginar; operadores revisan publicaciones/acuses pero no pueden acusar si no son destinatarios. Worker revalida snapshot aunque la lista del evento esté alterada. API candidates autorizada y paginada, sin depender de Chat. Web ofrece radios visibles y selector por búsqueda/páginas, errores propios y recuperación; Flutter omite acuse para isRecipient=false. GROUP/ROLE/SERVICE siguen futuros, no se anuncia targeting completo.

Verificación: 60 integraciones verticales y 65 integraciones totales con PostgreSQL/Valkey/Mailpit (2 opt-in omitidas), 100 unitarios JS, lint/typecheck/build API/worker/contracts/web pasan; Flutter analyze y 43 tests pasan. Matriz cubre no destinatario, actor no autorizado, FK tenant cruzado, duplicados, suspendido, audiencia nueva/histórica y outbox alterada. Primer pase completo falló sólo por contador OpenAPI 62→63; expectativa actualizada por ruta nueva y suite repetida aprobada. Bootstrap de doce migraciones/seed repetido/API pasó y eliminó nodra_verify_2bd22b9a9c03535e. Restore de 28 tablas con snapshot poblado y acuse API pasó: .local/restore/9709332144de0d5a/report.json, 4219 ms restore/verificación. No E2E DOM ni hardware/aceptación visual.

APK debug actualizado (build 31,7 s), firma v2 verificada; SHA-256 b4e30cb2f7c5f9ff2d03bab9e996252e56141e5e5dc9f7d291cbdb10fc912e2b. Desarrollo recibió migración aditiva sin reset. Stop-Process falló; taskkill terminó únicamente API/worker tras verificar sus commandlines. API nueva PID 13800/sesión 96313; worker PID 15832/sesión 39886; Next dev sesión 98199 conservada. Web/API LAN y worker loopback readiness devuelven 200. Sin Computer Use/subagentes ni servicios de pago. Estados NOD/DONE conservados y objetivo activo.

02/10 — NOD-010/019/020 (§191): contrato API de servicios añade filtros de rol e intervalo por solapamiento antes de contar/paginar; mantiene tenant/borradores, roles archivados y cancelados al final. 107 unitarios y 61 integraciones verticales aprobadas, lint/typechecks/builds aplicables. Pendientes: controles cliente, filtro group según recurso y aceptación global. No cambia estados ni elimina DONE. Ver detalle y limitaciones en PROJECT_STATE y docs/API.

02/10 — NOD-014/019/020 (§191): filtros de fechas y rol ya tienen controles web y navegación URL. 112 unitarios, lint/typecheck/build web y vertical HTTP/BFF en fixture local aprobados. La ampliación Flutter, paginación del catálogo de roles y filtro group contextual siguen pendientes. No cerrar estados por este avance; evidencia y límites en PROJECT_STATE/WEB_APP/TESTING.

02/10 — NOD-008/014/019/020 (§190/191): catálogo paginado API y selector de filtros web conectados. 119 unitarios, 62 verticales y BFF/API HTTP pasan; fixture de 105 roles prueba desaparición del límite en este selector. Migrar otros consumidores legacy GET roles (gestor, alta de posiciones, Flutter) continúa pendiente. Sin cambios en estados/DONE; pruebas y limitaciones en PROJECT_STATE/API/TESTING.

02/10 — NOD-008/014/019/020 (§190/191): alta de posiciones web reutiliza RoleCatalogPicker con búsqueda/páginas de diez, sólo roles activos y selección obligatoria; desaparece el límite de cien en este formulario. Modificar/crear roles refresca el selector. Alta de posición y de rol usan validación de contrato, errores inline con foco, bloqueo de envío duplicado y conservan campos ante rechazo. Una escritura reconocida por API se trata como guardada aunque falle la recarga, con aviso de recuperación y sin repetirla. Dos regresiones de saveServiceChange prueban esta separación; 121 unitarios JS, lint global, typecheck web y build Next pasan. No E2E DOM ni aceptación visual; API/schema no cambiaron y no se repitieron sus integraciones. Gestor de roles web y consumidores Flutter legacy siguen pendientes. Estados e historial DONE conservados; objetivo activo.

02/10 — NOD-008/014/020 (§190): gestor de roles web migrado al catálogo paginado de diez elementos con búsqueda, carga/error/reintento y páginas. Incluye archivados para reactivar; conserva el editor ante fallo de escritura y valida nombre/descripción sin mensajes emergentes nativos. Edición bloquea búsqueda/paginación para no perder el formulario. Tras escritura reconocida, un fallo al refrescar servicio se comunica como recarga pendiente. ServiceDetail deja de consultar GET roles legacy y no depende de ese catálogo para cargar el servicio. Respuestas tardías del catálogo se descartan; roles de otro tenant siguen protegidos por API. Flutter legacy y E2E de clientes siguen pendientes; no se cambia esquema/backend.

02/10 — Verificación final de altas/gestor web de roles: 121/121 unitarios JS (22 archivos), lint apps/packages, typecheck web, build Next y formato de los cinco archivos de código aprobados. Dos pruebas nuevas cubren escritura reconocida seguida de fallo al recargar y escritura rechazada sin recarga. Son pruebas de lógica, no E2E DOM de búsqueda/editor. Sin cambios API/migraciones ni repetición de las 62 verticales previas. Comprobación HTTP desde este ordenador: web LAN :3000, API LAN :4000/health/ready y worker loopback :4100/health/ready devuelven 200. Sin Computer Use/subagentes; documentación actualizada, estados/DONE conservados y objetivo completo del prompt sigue activo.

02/10 — NOD-008/015/020 (§190): gestor Flutter usa roles/catalog con búsqueda (debounce 180 ms), páginas de diez y total del servidor; consulta incluye roles archivados para reactivarlos. Búsqueda conserva texto ante fallo y ofrece reintento. Provider se identifica por organización/página/búsqueda y observa sesión; cada escritura comprueba de nuevo el contexto. Cambiar la organización del widget limpia búsqueda/página. Controles Material etiquetados y filas sin cards adicionales; edición conserva el formulario ante rechazo. La inspección de lib confirma que no quedan lectores de GET roles legacy en clientes web/Flutter; la API de compatibilidad se conserva. Filtros de servicios Flutter, E2E completo y prueba física siguen pendientes. Sin Computer Use/subagentes ni nuevas dependencias.

02/10 — Verificación catálogo Flutter: analyze --no-pub sin incidencias; suite completa 44/44 aprobada y formato Dart verificado. Nueva prueba widget recorre once páginas de un catálogo de 105 roles, muestra archivado, restablece página 1 al buscar y conserva búsqueda/reintento ante error. Pruebas previas de validación, edición, archivo/reactivación, MEMBER sin peticiones y cambio de tenant continúan pasando con contrato paginado. Primer analyze encontró import colocado al final y const inválido en texto dinámico: corregidos. Primeros ensayos del test fallaron por reintento automático de Riverpod y coincidencia de texto tanto en búsqueda como en fila; fixture configura retry desactivado para probar botón explícito y aserción identifica ListTile. No cambios de retry en producción. APK Android debug recompilado (53,9 s), firma v2 verificada: SHA-256 f727e844f096f69599fa344faa84713492aac8d023c175e41361c7937919fb1f. Usa API LAN http://192.168.1.133:4000/api/v1; no prueba física/iOS ni revisión visual. No se repitieron suites JS/API al no cambiar esos clientes/backend. Estados/DONE conservados y objetivo activo.

02/10 — NOD-015/020 (§191): Servicios Flutter añade búsqueda por título, estado y rol en desplegable Material; aplica/limpia con página 1, conserva filtros al volver de otra pestaña y los limpia al cambiar organización. Rol usa catálogo paginado con búsqueda y selección independiente de página, incluyendo archivados para consulta histórica. La query se codifica con Uri y combina filtros antes de la paginación en API; provider observa sesión. Vacío filtrado se distingue de organización sin servicios. Dos pruebas nuevas cubren parámetros combinados/encoding/cambio de tenant y restauración/aplicar/limpiar de controles. Analyze --no-pub y 46 pruebas completas pasan. Filtro por fechas en Flutter sigue pendiente: requiere conversión explícita de zona IANA/DST; no se sustituye por zona del teléfono ni campos UTC manuales. Filtro group contextual sigue pendiente sin relación Service–Group. Sin Computer Use/subagentes ni dependencia nueva, sin cambios API/schema y no se repiten sus suites. Estados e historial DONE conservados; objetivo activo.

02/10 — Build de filtros Flutter: APK Android debug compilado en 27,4 s y firma v2 verificada; SHA-256 f8c49b807ae45fb09d5dc8d2b20a89cf6592109c7d3514830c40eed036a4d0ad. API_URL LAN http://192.168.1.133:4000/api/v1. Dart format de los cuatro archivos editados pasa. No prueba física ni build iOS; la verificación del listado usa Dio interceptado y widgets, no recorrido contra servidor real. Sin cambios JS/API/worker ni repetición de esas suites. Objetivo activo y estados NOD conservados.

02/10 — NOD-015/020 (§191): filtros Flutter Desde/Hasta usan selector Material de fecha y hora en zona IANA de la organización. Ambos extremos son opcionales y se envían como instantes UTC para solapamiento semiabierto ya implementado en API; intervalo vacío/invertido se bloquea con error inline. Horas inexistentes por DST se rechazan; repetidas ofrecen ocurrencias con offset explícito. Catálogo completo de offsets valida roundtrip de campos, incluidos segundos cero para descartar offsets históricos espurios. Aplicar conserva segundos/milisegundos del UTC inicial si no se modifica; cambiar de organización limpia todos los filtros. Zona desconocida produce error, sin usar zona del dispositivo como sustituto. timezone 0.11.1 fijado y lock actualizado, base latest_all incluida localmente; sin cuentas/API remota, coste cero. Descarga inicial falló por red del sandbox y se completó con ejecución autorizada. No cambios de schema/backend ni pruebas físicas/Computer Use/subagentes.

02/10 — Verificación fechas Flutter: analyze --no-pub aprobado y 53/53 pruebas completas. Siete nuevas pruebas comprueban Madrid gap/fold, transición de 30 minutos Lord Howe, Kathmandu +05:45, día omitido Apia, zona inexistente, radio de segunda ocurrencia/restauración con segundos y bloqueo/limpieza de intervalo invertido. Pruebas de filtros anteriores amplían aserciones de parámetros from/to y conservación de milisegundos. Formato de siete archivos Dart aprobado. Primer analyze falló porque timezone 0.11.1 usa Duration para offset; implementación ajustada al código instalado y suite repetida aprobada. No E2E contra API real en este cambio ni prueba física, compatibilidad global de tzdb ni build iOS; backend/JS no cambiaron y no se repitieron sus suites. Estados NOD conservados y objetivo activo.

05/10 — Continuidad tras interrupción: no había procesos Nodra ni contenedores activos; arrancados PostgreSQL principal/test, Valkey y Mailpit existentes, cuatro healthy. PostgreSQL principal conserva volumen y doce migraciones, migrate status confirma sin pendientes; no reset/seed de desarrollo. Web Next dev sesión 36894 (PID puerto 1208), API sesión 92829 y worker sesión 62854 (PID 13344) arrancados tras inspeccionar puertos/procesos. HTTP desde este ordenador: web LAN 192.168.1.133:3000, API LAN :4000/health/ready y worker loopback :4100/health/ready = 200. Datos/historial conservados; postgres-test tmpfs se reconstruye por diseño y recibe migrate-test. Verificación de APK de fechas continúa; no confundir el APK anterior de 02/10 06:53 con este build. Sin Computer Use/subagentes ni servicios externos; objetivo activo y estados NOD/DONE conservados.

05/10 — Cerrada verificación pendiente de APK con fechas IANA/DST: build Android debug aprobado (168,8 s), firma v2 verificada con apksigner. SHA-256 4925cf4470a43bc7f985ce04eb39b9cf51249496903e07454b903cd2e1e0f8a1; artefacto apps/mobile/build/app/outputs/flutter-apk/app-debug.apk con API_URL http://192.168.1.133:4000/api/v1. Se compiló con acceso autorizado a la caché local de JNI tras fallo anterior de permisos; no cambio de código ni downgrade del cliente. Permanece warning de metadatos SDK XML v3/v4, sin impedir este build. Las 53 pruebas/analyze son evidencia de 02/10 del mismo código, no una nueva ejecución hoy. No prueba física ni build iOS. Cuatro contenedores saludables, doce migraciones principales sin pendientes y doce reaplicadas sólo en postgres-test tmpfs. Web/API LAN y worker loopback readiness 200; OpenAPI vivo incluye roles/catalog y active/search/page/limit. Sin Computer Use/subagentes/costes; estados/DONE conservados y objetivo activo.

31/10 — Publicación de la base acumulada autorizada por el propietario. README raíz reescrito en inglés con capacidades, arquitectura, arranque, cuentas exclusivamente locales, verificación y límites reales; 27 enlaces locales comprobados. Añadir posiciones registra SERVICE_UPDATED en la misma transacción Serializable. Nueva integración comprueba rechazo por permiso/rol inválido/estado publicado sin efectos, actor/tenant/entidad/fecha/metadata vacía y rollback real PostgreSQL ante fallo de auditoría inyectado. Pasan 121 unitarios JS, 63 integraciones verticales, lint global, typecheck API/worker/web y builds API/worker/packages/web. Primer intento de integración agotó hook de arranque en frío; repetición con hookTimeout=120000 aprobada sin cambiar configuración persistida. Tests unitarios requirieron acceso a caché temporal fuera del sandbox tras EPERM. Doce migraciones aplicadas sólo a postgres-test temporal; no reset de datos principales. Cachés .next/cache, node_modules/.vite, node_modules/.cache y .dart_tool/flutter_build eliminadas por petición, después de finalizar sus procesos. Flutter analyze/tests, hardware e iOS no repetidos en esta revisión. Sin Computer Use/subagentes ni servicios de pago. El objetivo completo sigue activo; estados e historial DONE conservados.
