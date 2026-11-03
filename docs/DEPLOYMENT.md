# Despliegue

Estado: sólo desarrollo local. No existe despliegue público ni procedimiento productivo validado.

Docker Compose actual levanta dependencias; API, worker y web se ejecutan en host. No confundir este archivo con una distribución completa de aplicaciones en contenedores. Next produce salida standalone; API y worker compilan con TypeScript. El build web copia `public` y `.next/static` al árbol standalone, incluidos marca, estilos y `/session-coordinator.js`; conservarlos junto a `server.js`. No requiere CDN. Al actualizar el coordinador, cerrar y reabrir las pestañas existentes; ver [WEB_APP](WEB_APP.md).

## Futuro en un único servidor

Opción prevista: PostgreSQL, Valkey, API, worker y web en un único servidor bajo control del propietario, con Caddy para HTTPS y red privada entre servicios. No se ha contratado VPS/dominio ni añadido Caddy al proyecto. Elegir proveedor/coste requiere instrucción explícita.

Antes de exponer: secretos nuevos, cookies seguras, orígenes reales, configuración de proxy/rate limit, persistencia/health, migraciones versionadas, observabilidad, proveedor de correo autorizado y retirada de seed/ConsolePush sensibles. Revisar licencias y reemplazar storage archivado; no publicar puertos internos.

## Copias y recuperación pendientes

Diseñar pg_dump con cifrado y retención, copia de objetos del storage actual y persistencia Valkey. Con el provider local hay que conservar `avatars/` y `organizations/` bajo `LOCAL_OBJECT_STORAGE_ROOT`, incluidas las imágenes de logo referenciadas por PostgreSQL. No copiar toda `.local` indiscriminadamente: también contiene herramientas y cachés. Probar restauración en base separada antes de considerar la copia válida. Definir RPO/RTO, responsable y procedimiento; no existe tarea de backup automatizada actualmente.

El simulacro de restore descrito a continuación incluye un avatar y un logo sintéticos, creados mediante la API. Comprueba sus bytes y la referencia del logo tras recuperar la base y los archivos. No sustituye una copia coordinada de todos los objetos vigentes. Un cierre abrupto o fallo de limpieza puede dejar logos sin referencia; no borrarlos por antigüedad sin contrastar `Organization.logoKey` y las subidas activas.

Ensayo local reproducible: `pnpm db:verify-restore` requiere Compose PostgreSQL en localhost:5432, Valkey en localhost:6379 y builds API/worker. Rechaza producción, hosts externos, parámetros de conexión y nombres ajenos al fixture. Crea dos bases `nodra_restore_<id>_source/target`; migra y genera datos sintéticos sólo en source. `pg_dump --format=custom` se cifra junto con el avatar y el logo usando AES-256-GCM; se comprueba que una alteración del archivo sea rechazada. `pg_restore --single-transaction --exit-on-error` carga target y se restauran ambos objetos en un directorio propio, conservando sus claves. No lee ni sobrescribe datos de desarrollo.

El 02/10 pasó: comparación de las 27 tablas (todas sus filas), constraints, índices, triggers de capacidad, funciones y enums; login contra API restaurada, rechazo tenant ajeno, borradores ocultos al miembro, avatar binario, historial de chat y recuperación de outbox en una cola Valkey temporal. La fase restore/verificación tardó 1368 ms en este fixture pequeño; no constituye un RTO productivo. Ambas bases y la cola temporal se eliminan al terminar. El informe queda en `.local/restore/<id>/report.json`; sólo contiene conteos, hashes y resultados. Las credenciales de PostgreSQL se pasan por entorno, sin argumentos ni logs de errores completos.

Este comando es un simulacro, no una copia de seguridad del usuario ni un scheduler de backups. La clave de cifrado vive sólo durante el ensayo y no se conserva: el archivo cifrado de prueba no sirve para recuperación posterior. Copia fuera del host, retención, custodia separada de claves, snapshots consistentes, roles/permisos de infraestructura y restauración de un volumen real siguen pendientes para producción.

La estrategia futura debe combinar un dump lógico de PostgreSQL (incluidos roles/permisos necesarios para reconstruir el entorno), una copia de avatares, logos y configuración sin publicar secretos, y snapshots de volúmenes consistentes cuando se usen. Un snapshot tomado durante escrituras sin coordinación no sustituye una copia verificable. Para datos y objetos, fijar un punto de corte o documentar la reconciliación de referencias para no restaurar metadatos sin su imagen. Valkey es cola recuperable desde outbox PostgreSQL; su copia no sustituye la base autoritativa.

Mantener al menos una copia cifrada fuera del host principal, por ejemplo en un disco separado bajo control del propietario; no requiere contratar almacenamiento cloud. Guardar la clave de recuperación separada de la copia y limitar acceso. Definir retención y eliminación, comprobar integridad, y ensayar restore en DB/directorio aislados sin sobrescribir desarrollo ni producción. El ensayo debe reconstruir migraciones/datos, permisos tenant, avatares, logos y pendientes del worker, y registrar tiempo real de recuperación contra RPO/RTO. El simulacro sintético ya está automatizado y probado; dumps/snapshots de datos reales y copia separada aún no constituyen un procedimiento productivo validado.

03/11 — Ampliación aprobada en `1ccf82101419c2ed`: 28 tablas y esquema coinciden; avatar y logo conservan sus hashes. La API restaurada devuelve el logo al miembro con MIME JPEG y cache privado, mantiene su logoUrl, rechaza acceso sin sesión con 401 y tenant ajeno con 403. El primer intento, sin copiar el logo, falló en su comprobación y dejó cero logos restaurados; al incluirlo en el paquete cifrado pasa el recorrido completo, incluida outbox. Las seis bases propias de los tres intentos fueron eliminadas. Informe local `.local/restore/1ccf82101419c2ed/report.json`. No es una copia de los datos del propietario ni una validación de RPO/RTO productivo.

Escalar primero mediante índices, consultas medidas y workers adicionales; luego réplicas de API sin sesión en memoria. Mantener integridad y outbox en PostgreSQL. No introducir microservicios o infraestructura distribuida sin necesidad medida.

## Evolución por etapas

Diseño futuro de §126–128; no es infraestructura ya contratada ni un despliegue verificado. Cada etapa necesita medición y autorización del propietario si implica gasto. Preferir herramientas locales/self-hosted gratuitas; no adoptar Kubernetes ni dividir el dominio en microservicios.

| Etapa                   | Cambio previsto                                                            | Condición e invariante                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Un servidor             | Caddy, web, API, worker, PostgreSQL, Valkey y objetos locales persistentes | HTTPS externo; puertos internos privados, migraciones de un único ejecutor, backups y restore probados                                |
| DB separada             | PostgreSQL en host privado independiente                                   | Sólo si recursos/IO lo requieren; conectividad autenticada, misma integridad tenant y transacciones                                   |
| API replicada           | Varias instancias del mismo monolito                                       | Sin sesiones/locks de negocio en memoria; configurar proxy/rate limit compartido y evitar migraciones simultáneas                     |
| Workers separados       | Escalar consumidores del mismo contrato de eventos                         | BullMQ/DB conservan idempotencia; no prometer SMTP exactly-once, medir capacidad y retraso                                            |
| Valkey separado         | Persistencia y cuotas en host propio                                       | Noeviction, cola recuperable desde outbox; pérdida/restauración de cola probadas                                                      |
| Object storage separado | Provider compatible con el contrato actual                                 | Elegir alternativa mantenida gratuita/self-hosted antes de producción; no adoptar el fixture MinIO archivado como servicio productivo |
| Balanceador             | Frente a réplicas API/web                                                  | Health y drenaje, HTTPS y headers de proxy permitidos; sin exponer DB/Valkey                                                          |
| Réplicas DB             | Lecturas no críticas, tras necesidad medida                                | Confirmación/capacidad/invitaciones y lecturas que autorizan escritura permanecen en el primario; controlar retraso                   |

Next standalone y artefactos API/worker son base de empaquetado, no imágenes publicadas. Faltan Dockerfiles de aplicaciones, Compose productivo/Caddyfile, rollback, copias cifradas y restores. Backups deben incluir `.local/avatars` además de metadatos PostgreSQL actuales; no esperar a que se añadan documentos. No registrar credenciales en comandos/logs ni usar seed de desarrollo fuera del entorno local. [OBSERVABILITY](OBSERVABILITY.md) prepara instrumentación local sin exporter comercial obligatorio. Los builds iOS automatizados siguen futuros y requieren un host macOS autorizado, sin contratar runners para esta fase.
