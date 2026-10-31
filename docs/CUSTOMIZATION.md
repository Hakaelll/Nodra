# Personalización y presets

Diseño para §59/61/62 del [prompt](BOOTSTRAP_PROMPT.md). Distingue la edición disponible de los campos futuros. Organization permite corregir name y timezone; OrganizationSettings conserva serviceLabel y features. No hay logo organizativo, editor de terminología ni selector de accent. La foto personal no es un logo de organización.

## CustomFieldDefinition y CustomFieldValue

Implementación futura en el monolito modular, con PostgreSQL y sin constructor de formularios complejo. Primero soportar Service; incorporar otras entidades sólo con relaciones explícitas y autorización propia.

CustomFieldDefinition: id UUID, organizationId FK, key estable (slug), label, type, required boolean, config JSON validado por tipo, position integer, active boolean, createdAt y updatedAt. Unique (organizationId, key) y (id, organizationId). Nunca borrar una definición usada; archivar impide nuevos valores y conserva lectura histórica. No cambiar type si tiene valores: crear otra definición y migrar explícitamente tras validar.

CustomFieldValue: id UUID, organizationId, definitionId, serviceId, value JSON, revision, createdAt y updatedAt. FKs compuestas (definitionId, organizationId) y (serviceId, organizationId); unique (definitionId, serviceId). El backend comprueba tipo y límites de config dentro de la transacción. Un valor ausente es distinto de false, cero o texto vacío. Los required se comprueban al publicar el servicio, sin impedir guardar un borrador incompleto. Index inicial (organizationId, serviceId); no permitir consultas JSON arbitrarias del cliente.

| Tipo        | Representación y límites iniciales                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| TEXT        | String, trim y maxLength configurable con techo 5000; sin HTML                                          |
| NUMBER      | Decimal como string canónico, escala/límites explícitos; no parseFloat ni precisión monetaria implícita |
| BOOLEAN     | Boolean real, sin convertir cualquier string a true                                                     |
| DATE        | YYYY-MM-DD civil válido, sin convertirlo automáticamente a UTC                                          |
| SELECT      | ID estable de opción activa de la definición; etiquetas editables sin alterar valores históricos        |
| MULTISELECT | IDs únicos, límite de opciones; mismo control que SELECT                                                |
| LOCATION    | Texto acotado; latitud/longitud opcionales validadas conjuntamente; sin geocodificador externo          |
| USER        | Referencia a Membership del mismo tenant; tabla de referencia con FK compuesta, no sólo UUID en JSON    |
| FILE        | Referencia a attachment privado del tenant con FK; nunca URL arbitraria ni base64 dentro de value       |

USER y FILE necesitan referencias tipadas auxiliares, por ejemplo CustomFieldMembershipValue y CustomFieldAttachmentValue, con FK al valor y al recurso/organizationId. FILE permanecerá deshabilitado hasta implementar uploads de documentos, cuotas, autorización de lectura y borrado. La subida de avatar existente no sirve como almacenamiento de documentos. El provider predeterminado seguirá local/gratuito; no activar servicios comerciales.

OWNER/ADMIN administran definiciones; los roles con operate editan valores del Service de su organización. MEMBER sólo ve campos publicados autorizados, nunca configuración administrativa ni referencias a personas ajenas al tenant. features.customFields apagado conserva datos, no entrega valores nuevos ni permite escritura. Auditar creación/edición/archivo sin copiar valores sensibles. Usar control revision para rechazar ediciones obsoletas.

Antes de activar: migración aditiva con FKs/checks, validación Zod discriminada, pruebas de todos los tipos/límites, aislamiento y referencias cruzadas, required al publicar, archive y cambios concurrentes. No existe aún esta suite ni estas tablas.

## Identidad de organización

Implementado el 31/10: OWNER/ADMIN pueden editar nombre (2–120 caracteres) y zona IANA desde Perfil → Configuración. PATCH organizations/:org exige el par expected anterior, rechaza cambios obsoletos con 409 y registra ORGANIZATION_UPDATED en la misma transacción. No cambia slug ni instantes UTC de servicios. Los offsets fijos no son zonas IANA; un valor antiguo de ese tipo puede corregirse usando su snapshot esperado.

Pendiente: añadir logo mediante upload autenticado OWNER/ADMIN, clave derivada del organizationId autorizado, recodificación raster y límites equivalentes al avatar; no aceptar SVG activo ni URL de terceros. Lectura requiere Membership. No reutilizar la ruta de foto personal ni exponer storage público.

terminology será un objeto estricto para service singular/plural y jobRole singular/plural, con etiquetas acotadas, sin HTML ni CSS. Los identificadores internos, rutas y estados se mantienen neutrales y estables. accent será un enum pequeño de tokens contrastados del design system; no hex libre, no fuentes, layouts, CSS ni sombras configurables. La UI siempre conserva foco, estados de error y navegación coherentes. Estas opciones aún no están implementadas ni activables por settings/features.

## Presets futuros

Son plantillas versionadas de datos, nunca clases, permisos ni workflows por sector. Un preset crea roles, definiciones y sugerencias de etiquetas en la misma organización autorizada. No publica servicios ni invita personas. Desactivarlo no borra datos creados.

| Preset      | Roles sugeridos                | Campo opcional de Service     | Nomenclatura sugerida |
| ----------- | ------------------------------ | ----------------------------- | --------------------- |
| Events      | Coordinación, recepción, apoyo | Punto de encuentro (LOCATION) | Servicio / Rol        |
| Hospitality | Recepción, atención, apoyo     | Área (TEXT)                   | Servicio / Rol        |
| Catering    | Preparación, atención, apoyo   | Punto de entrega (LOCATION)   | Servicio / Rol        |
| Cleaning    | Coordinación, limpieza, apoyo  | Zona (TEXT)                   | Servicio / Rol        |
| Generic     | Coordinación, apoyo            | Referencia (TEXT)             | Servicio / Rol        |

La aplicación muestra preview antes de aplicar y permite elegir elementos. Guardar PresetApplication(organizationId, presetKey, version), unique sobre esa combinación, y claves estables por elemento; reintento no duplica. Si ya existe un rol/definición con el mismo nombre/key, mostrar conflicto y mapearlo explícitamente, sin sobrescribir configuración. Aplicar una nueva versión requiere una nueva preview. Auditoría incluye presetKey/version e IDs creados, no valores privados. Pruebas futuras: reintentos, carrera, tenant, permisos, conflicto de nombres, desactivación y rollback completo. No hay selector ni ejecución de presets actualmente.
