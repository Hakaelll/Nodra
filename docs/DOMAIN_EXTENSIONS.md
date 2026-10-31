# Disponibilidad y destinatarios de avisos

Estado: Availability y targeting GROUP/ROLE/SERVICE siguen futuros. ORGANIZATION/USERS y NoticeRecipient están implementados desde 02/10; el alcance vigente se describe en DATA_MODEL y API. La vertical mantiene conflictos básicos por asignación. Este diseño conserva Membership como frontera de autorización y PostgreSQL como fuente de verdad; no introduce proveedores ni costes.

## Availability

Una disponibilidad pertenece a una Membership concreta, no al usuario global. La misma persona puede comunicar información distinta a cada organización sin revelar otras relaciones laborales.

| Campo previsto                  | Contrato                                                       |
| ------------------------------- | -------------------------------------------------------------- |
| id                              | UUID                                                           |
| organizationId, membershipId    | FK compuesta a Membership(id, organizationId)                  |
| kind                            | AVAILABLE o UNAVAILABLE                                        |
| startsAt, endsAt                | Instantes timestamptz; endsAt > startsAt                       |
| timezone                        | Zona IANA del registro, para edición y recurrencia futura      |
| createdBy, createdAt, updatedAt | Actor y trazabilidad; no introducir notas privadas por defecto |
| revision                        | Control de edición concurrente, incrementado por cada cambio   |

Índice inicial (organizationId, membershipId, startsAt); añadir otros sólo tras medir las consultas. Los intervalos son semiabiertos [inicio, fin): acabar a las 18:00 no entra en conflicto con empezar a las 18:00. La ausencia de registro significa «no informado», nunca disponibilidad afirmativa.

Una Membership ACTIVE puede crear/editar su disponibilidad propia; OWNER/ADMIN/COORDINATOR pueden consultar la del equipo de su organización. No pueden editarla en nombre de otra persona inicialmente. El backend deriva membershipId del usuario autenticado en las mutaciones propias y vuelve a comprobar organización/estado en transacción. Cambiar disponibilidad no cancela automáticamente una asignación ni altera una Confirmation histórica.

UNAVAILABLE prevalece sobre AVAILABLE si coinciden; el cliente debe explicar el conflicto y permitir editar los intervalos. Primero se almacenan ocurrencias concretas. La recurrencia se reservará para AvailabilityRule y AvailabilityException con límites de expansión y excepciones por día local; no almacenar un RRULE sin motor de interpretación probado. Las reglas mantendrán timezone, duración local, inicio/fin de vigencia y resolverán de forma explícita las horas inexistentes/duplicadas al cambiar el horario de verano. No expandir indefinidamente en una consulta.

Antes de activar features.availability: migración, autorización propia/tenant, pruebas de intervalos adyacentes y solapados, ausencia de datos, cambios concurrentes, Membership suspendida y DST; UI para editar y distinguir «no informado». La comprobación actual de conflictos con asignaciones confirmadas seguirá funcionando aunque esta función esté apagada.

## NoticeTarget y NoticeRecipient

Notice es contenido de negocio; DomainEvent/Notification son entrega. El target define audiencia y un snapshot de destinatarios permite explicar quién recibió la publicación aunque después cambie el grupo. No usar un ID genérico sin FK como única garantía de pertenencia al tenant.

NoticeTarget previsto: (noticeId, organizationId, type), con FK compuesta a Notice(id, organizationId), y referencias opcionales groupId, jobRoleId o serviceId. Cada referencia tiene FK compuesta con organizationId. Checks exigen exactamente la referencia del tipo correspondiente y ninguna para ORGANIZATION/USERS; inicialmente un único target por Notice evita combinaciones ambiguas. El campo actual Notice.targetType puede migrarse a enum cuando esta función se implemente, después de validar los valores existentes.

NoticeRecipient previsto: (noticeId, membershipId, organizationId), PK (noticeId, membershipId), FK compuesta a Notice y a Membership. Es el snapshot único usado para lectura, acuse y entrega; el backend mantiene además el requisito de Membership ACTIVE para acceder. Publicar requiere permiso operate y resolver audiencia dentro de la misma transacción que Notice, targets, recipients, auditoría y DomainEvent. Se limita el tamaño de la audiencia/payload; no enviar correo ni push dentro de la transacción.

| Tipo         | Resolución prevista en la organización del Notice                                                 |
| ------------ | ------------------------------------------------------------------------------------------------- |
| ORGANIZATION | Todas las Membership ACTIVE al publicar                                                           |
| GROUP        | Membership ACTIVE pertenecientes al Group activo indicado; groups debe estar habilitado           |
| ROLE         | Membership ACTIVE con el JobRole indicado mediante futura MembershipJobRole; nunca PermissionRole |
| SERVICE      | Personas con asignación CONFIRMED en el Service indicado; deduplicar si hay varias posiciones     |
| USERS        | Lista explícita y acotada de membershipIds ACTIVE del tenant; no aceptar userIds ajenos           |

MembershipJobRole aún no existe: deberá unir Membership y JobRole con FKs compuestas de organización y PK (membershipId, jobRoleId). No inferir que un rol laboral concede permisos administrativos ni deducirlo de haber participado una vez en un servicio. ROLE permanecerá deshabilitado hasta implementar esa relación y su gestión autorizada.

Un cambio de grupo/rol después de publicar no añade nuevos destinatarios a una publicación anterior. Suspensión o baja impide acceso y entrega pendiente; la evidencia histórica del snapshot y acuses se conserva. Reactivación permite consultar los avisos de los que esa Membership era destinataria; no añade avisos publicados durante su baja. Una edición de audiencia no mutará silenciosamente un aviso publicado: requerirá una nueva publicación, con auditoría y control explícito de duplicación.

La lectura/lista de MEMBER se filtrará por NoticeRecipient. OWNER/ADMIN/COORDINATOR podrán consultar publicaciones administradas en el tenant y sus acuses según el permiso operativo; no se enviarán nombres ajenos a MEMBER. El acuse requerirá destinatario propio, Membership ACTIVE y requiresAcknowledgement; la PK existente noticeId/userId mantiene idempotencia. La entrega del worker vuelve a comprobar Membership y snapshot, incluso tras varios reintentos.

## Migración y pruebas pendientes

No alterar ahora las publicaciones existentes ni su semántica de difusión. La migración futura debe definir y probar el backfill de ORGANIZATION antes de cambiar filtros de lectura; la información actual no permite reconstruir con exactitud quién estaba ACTIVE en cada fecha pasada. Cualquier backfill debe registrar ese límite, preservar todos los acuses y evitar presentar una audiencia reconstruida como snapshot histórico exacto.

Pruebas requeridas antes de activar targeting: IDs reales de otro tenant rechazados por API y FK; deduplicación; lista/acuse de no destinatario; permisos por rol; publicación concurrente con suspensión; cambio de grupo/rol sin acceso retroactivo; snapshot conservado después de baja; retry sin nueva Notification; backfill que conserva acuses. Sólo entonces habilitar nuevas opciones en web/Flutter. Esta especificación satisface la preparación arquitectónica; no acredita una implementación de targeting.

02/10 — Audiencias de avisos (§52/76): POST /organizations/:org/notices acepta targetType=ORGANIZATION (predeterminado) o USERS y membershipIds (UUIDs, máximo 100, deduplicados). USERS exige al menos uno; ORGANIZATION rechaza IDs explícitos. Publicación opera en transacción Serializable: sólo Membership ACTIVE con User activo del tenant, snapshot NoticeRecipient, Notice/auditoría/evento atómicos. Un destinatario ajeno o suspendido devuelve 404 y no publica. GET /organizations/:org/notices/candidates requiere OWNER/ADMIN/COORDINATOR; page/limit/search paginan personas activas por nombre/id, con búsqueda por nombre/apellidos, sin requerir Chat.

Los listados MEMBER y pendientes propios filtran audiencia antes de paginar; operadores pueden consultar publicaciones del tenant y sus acuses. isRecipient indica si el usuario actual puede acusar lectura; no se expone el listado de destinatarios a MEMBER. Acknowledge requiere destinatario propio y conserva idempotencia. Worker vuelve a comprobar snapshot y Membership activa antes de entregar. Publicaciones nuevas de ORGANIZATION también fijan audiencia al publicar. Las anteriores conservan audienceVersion=0/difusión dinámica; no se inventa su audiencia histórica ni se alteran sus acuses. GROUP/ROLE/SERVICE aún no aceptados. OpenAPI actual: 63 operaciones.
