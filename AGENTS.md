# Nodra — instrucciones de continuidad

El repositorio es la fuente de verdad, no la memoria de conversaciones anteriores.

1. Leer PROJECT_STATE.md y NEXT_TODOS.md.
2. Leer la documentación afectada y docs/design.md antes de tocar UI.
3. Inspeccionar implementación, esquema, migraciones y tests; no rehacer trabajo completado.
4. Respetar el monolito modular, aislamiento por Membership y vocabulario neutral.
5. Ejecutar lint, typecheck, tests y builds aplicables. No declarar verificaciones no realizadas.
6. Actualizar documentación, PROJECT_STATE.md y NEXT_TODOS.md; conservar IDs e historial DONE.

Nodra se encuentra actualmente en una fase de coste cero. Ningún agente puede introducir una tecnología, API, SaaS, servicio cloud o infraestructura de pago, trial, créditos o requisito de tarjeta bancaria sin una instrucción explícita del propietario del proyecto.

Cuando exista una alternativa self-hosted, gratuita y razonable, debe preferirse durante esta fase.
Los adapters para proveedores comerciales futuros son válidos, pero el provider predeterminado debe ser gratuito/local.

No implementar ERP, pagos, IA, marketplace ni integraciones comerciales. Autorización en backend; nunca confiar en organizationId del cliente. Transacciones y constraints protegen capacidad e invitaciones. No registrar secretos.
