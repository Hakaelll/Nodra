# Observabilidad local

Preparación de §106–108 del [prompt](BOOTSTRAP_PROMPT.md). Actualmente hay logs Pino en API/worker, requestId en errores API, health/ready con PostgreSQL y estados persistidos de outbox/entrega. No existe SDK ni collector OpenTelemetry configurado, exporter, dashboard de métricas ni tracing distribuido. `OTEL_ENABLED` era una reserva en el ejemplo de entorno y no tiene efecto en configuration(). No anunciar instrumentación por la presencia de esa variable.

## Base OpenTelemetry prevista

Mantener un módulo interno de telemetry con implementación no-op predeterminada; instrumentación futura opcional antes del arranque de Nest y worker. Su fallo nunca impide autenticar, gestionar servicios ni despachar eventos. No exportar a ningún SaaS por defecto ni exigir tarjeta/cuenta/créditos. Si se activa, el destino inicial será un collector self-hosted de la red privada del propietario; endpoint, retención y cuotas se validarán antes de habilitarlo.

Contrato propuesto: withSpan(name, safeAttributes, operation), counter(name, allowedLabels) y duration(name, allowedLabels). Sólo atributos definidos en una allowlist; rechazar claves libres. Los módulos de dominio no importarán exporters ni crearán lógica de negocio dependiente de telemetría. Un exporter opcional deberá inicializarse una sola vez por proceso, vaciarse con plazo acotado al cerrar y tolerar destino desconectado. Las variables futuras se añadirán al schema de config, con defaults locales/desactivados, cuando el módulo exista.

| Superficie    | Señales previstas                                                                     | Límites                                                                       |
| ------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| API           | Duración/conteo por método, plantilla de ruta y clase de estado HTTP; requestId local | Nunca URL completa/query, Authorization/Cookie ni cuerpos                     |
| Autenticación | Resultado genérico éxito/rechazo/rate limit                                           | Sin email, token, contraseña, IP como label ni motivo que revele cuenta       |
| PostgreSQL    | Duración por operación/módulo y conflictos serializables reintentados                 | Sin SQL con parámetros, connection string ni contenido de filas               |
| Outbox        | Pendientes/edad del más antiguo, resultado de dispatch, retraso/reintentos            | Sin título/cuerpo, lista de destinatarios ni tokens de cuenta                 |
| Worker        | Duración/resultado por kind y canal, retries, jobs retenidos fallidos                 | Labels acotados; IDs de trabajo sólo en log autorizado, no series por persona |
| Storage       | Resultado y latencia por operación/provider                                           | Sin claves privadas/URL firmadas/contenido ni credenciales                    |

No usar organizationId/userId/email como dimensiones de métricas. Los errores públicos mantienen requestId y mensaje seguro, sin stack. Los logs actuales de API tienen reqId; no existe aún correlación de spans API→outbox→worker. Un contexto futuro se guardará sólo como trace metadata validada, fuera del payload de negocio y sin permitir que el cliente falsifique identidad/permisos. Mantener límites de longitud y rechazo de headers de tracing inválidos.

## Validación antes de activación

1. Tests de allowlist/redacción con secretos canario y de alta cardinalidad rechazada.
2. API y worker funcionan con implementación no-op y con exporter desconectado; plazos de cierre acotados.
3. La cola no depende del collector; reintentos conservan DomainEvent/Notification idempotentes.
4. Recorrido local API→outbox→worker con correlación real y exportación sólo al destino permitido, sin datos privados.
5. Medir overhead y límites de cola/buffer, muestreo y retención. Ningún backpressure de tracing bloquea operaciones de negocio.

Prometheus/Grafana/Loki locales pueden añadirse después si una necesidad operativa medida lo justifica; no se despliegan en esta iteración ni se declaran disponibles. Alertas futuras: readiness DB, outbox envejecida y entrega fallida persistente; deben tener umbral, responsable y procedimiento de resolución. Readiness API comprueba DB; readiness del worker (`127.0.0.1:4100/health/ready`) comprueba PostgreSQL, conexiones Valkey y consumidor activo, con plazo 1500 ms y sondas simultáneas compartidas. Ninguno certifica SMTP/storage, estado de todos los jobs ni disponibilidad global. Caída/reconexión de Valkey del worker verificada con un proxy aislado y entrega real posterior.
