# Roadmap

Los estados ejecutables y criterios están en NEXT_TODOS.md. Esta lista describe dirección, no compromiso de implementar todo ahora.

## Phase 0 — Foundation

Monorepo, arquitectura, esquema/migraciones, configuración, CI y documentación. Implementados en buena parte; quedan gates de infraestructura y auditoría.

## Phase 1 — Coordination MVP

Identidad, Memberships, invitaciones, servicios/posiciones, interés, selección, confirmación, avisos y UI web/móvil. Primera vertical implementada. Completar notificaciones verificadas, rutas web, administración y pruebas E2E antes de declarar MVP terminado.

## Phase 2 — Availability

Disponibilidad explícita, ausencias, conflictos explicables y reservas. Actualmente sólo hay comprobaciones de solapamiento en operaciones concretas.

## Phase 3 — Customization

Feature/OrganizationFeature, campos personalizados tipados y configuración de organización. No SaaS de feature flags.

## Phase 4 — Documents / operations

Documentos, políticas de subida, storage mantenido, acceso privado y retención. Contrato ObjectStorageProvider y adapter S3 para fotos existen; documentos, retención y proveedor productivo mantenido siguen pendientes.

## Phase 5 — Analytics

Indicadores basados en consultas reales y permisos; no métricas ficticias ni tracking comercial obligatorio.

## Future

Chat ya fue autorizado por el propietario e implementado en API/web/Flutter; conserva sus verificaciones pendientes en NOD-022. Timesheets, gastos, workflows e integraciones requieren alcance posterior explícito. No implementar ERP, nóminas, facturación, pagos, marketplace o IA durante este bootstrap. FCM/APNs, correo productivo y cualquier proveedor potencialmente comercial requieren decisión del propietario; nunca trial ni tarjeta para desarrollo.
