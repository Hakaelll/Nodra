# Aislamiento por organización

Una identidad global puede tener varias Memberships. La selección de organización en web/móvil es contexto de navegación, nunca autorización. La API consulta Membership ACTIVE por cada operación y aplica permisos del tenant seleccionado.

Todas las consultas a entidades privadas deben incluir organizationId, también cuando conocen un UUID. Roles, grupos, posiciones, asignaciones y avisos deben pertenecer al mismo tenant. Las claves compuestas de la migración invariants complementan las validaciones; no sustituyen Policy.

Las transacciones agrupan validación, cambios, auditoría y outbox. El worker comprueba nuevamente Membership activa y User activo antes de entregar. No mantener permisos en caché sin un plan explícito de invalidación.

## Evidencia

vertical.integration.test.ts crea organizaciones independientes y rechaza lecturas/escrituras sin Membership y referencias cruzadas de los escenarios cubiertos. También prueba permisos y consumo concurrente de invitaciones. No equivale a cobertura exhaustiva de todos los endpoints.

Riesgos a revisar al añadir funciones: joins sin filtro, búsquedas globales, logs con datos de otra organización, caches sin tenant, links que conservan selección previa y exports sin autorización. Al cambiar organización, invalidar datos y selección de servicio del cliente. Web ya incluye org/view/service en URL, remonta el workspace al cambiar tenant y rechaza organizaciones no disponibles sin fallback silencioso. Atrás/Adelante del detalle se verificaron en navegador.
