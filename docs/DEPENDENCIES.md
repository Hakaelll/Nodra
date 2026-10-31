# Dependencias y coste

Inventario del 21/09/2026. Versiones resueltas observadas en node_modules y pubspec.lock; pnpm-lock.yaml es la fuente reproducible. Rangos de package.json no equivalen siempre a la versión instalada.

| Technology             | Version         | License                     | Purpose              | Alternative considered | Reason selected                                |
| ---------------------- | --------------- | --------------------------- | -------------------- | ---------------------- | ---------------------------------------------- |
| Node.js                | 24.19.0 local   | Ver LICENSE de distribución | Runtime              | Otros runtimes JS      | Stack compatible                               |
| pnpm                   | 11.19.0         | Ver licencia de instalación | Workspaces           | npm                    | Lock y dependencias por workspace              |
| NestJS core            | 12.0.3          | MIT                         | Módulos API          | Fastify directo        | Estructura de dominio                          |
| Fastify                | 5.12.4 override | MIT                         | HTTP                 | Express                | Adapter elegido                                |
| Prisma / adapter-pg    | 7.10.0          | Apache-2.0                  | ORM/migraciones      | SQL manual             | Modelo tipado                                  |
| pg                     | 8.23.0          | MIT                         | Driver PostgreSQL    | Driver alternativo     | Adapter oficial                                |
| Zod                    | 4.6.5           | MIT                         | Validación/contratos | Validación manual      | Esquema común                                  |
| argon2                 | 0.45.1          | MIT                         | Password hashing     | bcrypt                 | Argon2id                                       |
| Next.js                | 16.3.5          | MIT                         | Web/BFF              | SPA                    | Cookies server-side                            |
| React / React DOM      | 19.3.0          | MIT                         | UI                   | Otro framework         | Integración Next                               |
| Tailwind / PostCSS     | 4.3.3           | MIT                         | Estilos              | CSS exclusivo          | Integración existente                          |
| Lucide React           | 0.577.0         | ISC                         | Iconos               | SVG ad hoc             | Consistencia                                   |
| Inter Tight variable   | 5.3.0 paquete   | OFL-1.1                     | Fuente local         | Fuente de sistema      | Sustituto de referencia aportada               |
| BullMQ                 | 5.81.5          | MIT                         | Cola                 | Bus distribuido        | Retries locales                                |
| Nodemailer             | 8.0.11          | MIT-0                       | SMTP local           | SDK comercial          | Sin servicio externo                           |
| Pino                   | 10.3.1          | MIT                         | Logs                 | SaaS de logs           | Local/redacción                                |
| dotenv                 | 17.4.2          | BSD-2-Clause                | Config local         | Variables manuales     | Setup reproducible                             |
| TypeScript             | 5.9.3           | Apache-2.0                  | Tipos                | JS sin tipos           | Contratos estrictos                            |
| ESLint                 | 10.11.0         | MIT                         | Lint                 | Revisión manual        | Gates locales                                  |
| Prettier               | 3.9.8           | MIT                         | Formato              | Formato manual         | Consistencia                                   |
| Vitest                 | 4.1.11          | MIT                         | Tests                | Otro runner            | TS e integración                               |
| embedded-postgres      | 18.4.0-beta.17  | MIT wrapper                 | Fixture Windows      | Docker                 | Alternativa local sin Docker; no producción    |
| Flutter                | 3.47.5          | BSD-3-Clause                | Android/iOS          | Nativo separado        | Código compartido                              |
| flutter_riverpod       | 3.4.3           | MIT                         | Estado               | Estado manual          | Sesión/contexto                                |
| go_router              | 18.0.1          | BSD-3-Clause                | Rutas                | Navigator manual       | Rutas declarativas                             |
| dio                    | 5.11.1          | MIT                         | HTTP móvil           | HTTP básico            | Interceptores/timeouts                         |
| flutter_secure_storage | 11.2.0          | BSD-3-Clause                | Tokens móviles       | Preferencias planas    | Almacenamiento seguro                          |
| intl                   | 0.20.3          | BSD-3-Clause                | Fechas               | Formato manual         | Localización                                   |
| image_picker           | 1.2.3           | BSD-3-Clause                | Galería móvil        | Selector propio nativo | Plugin Flutter mantenido, sin servicio externo |
| image                  | 4.10.0          | MIT                         | Recorte/JPEG móvil   | Procesamiento servidor | La foto se encuadra antes de subirse           |

Licencias JS principales leídas de package.json instalado y Flutter de archivos LICENSE de SDK/pub cache. Las licencias de `image_picker` e `image` se contrastaron también con pub.dev. Esto no es una auditoría legal ni un inventario exhaustivo de transitivas o binarios incorporados.

## Infraestructura declarada

Compose referencia PostgreSQL 17-alpine, Valkey 8.1-alpine y Mailpit v1.31.1. Son servicios locales, no cuentas alojadas. En Windows, `infrastructure/scripts/local-mailpit.ps1` fija el ZIP oficial v1.31.1 y comprueba su SHA-256 antes de ejecutarlo; se verificó además el SHA-256 del binario extraído. Docker Desktop permitió arrancar PostgreSQL principal, Valkey, Mailpit, postgres-test y MinIO opcional; se verificó health y transporte real de cola/SMTP. `@aws-sdk/client-s3` 3.1132.0 (Apache-2.0) implementa el adapter S3 opcional y se probó sólo con MinIO local. La revisión final de licencias de las imágenes sigue pendiente.

MinIO opcional se compiló con la referencia indicada en infrastructure/docker/Minio.Dockerfile, arrancó y su endpoint de salud devolvió 200. El archivo registra upstream archivado: no cumple el criterio de mantenimiento para adopción productiva. Queda aislado al perfil storage como fixture de compatibilidad solicitado. `ObjectStorageProvider` separa filesystem predeterminado y S3 opcional en la API de fotos; no hay uploads de documentos. Debe elegirse una alternativa mantenida antes de desarrollar documentos. Licencia/distribución y compatibilidad de esa alternativa requieren revisión.

## Coste

Required paid services: None. Required external accounts: None. No trials, créditos ni tarjeta. Los paquetes instalados no implican contratar soporte comercial. Herramientas de escritorio, distribución de apps y hosting tienen condiciones propias; no se han contratado.

Adapters futuros para proveedores comerciales son aceptables sólo con decisión explícita y conservando desarrollo local gratuito. No activar FCM/APNs, correo productivo, analítica o storage cloud por defecto.

02/10 — Toolchain Android local: Eclipse Temurin JDK 21.0.12.1+1 (OpenJDK, GPLv2 con Classpath Exception), SDK command-line tools 22.0/archivo 15859902 y paquetes Android SDK/NDK bajo sus términos de desarrollo. Herramientas locales gratuitas, sin cuenta ni runtime comercial; no se redistribuyen dentro del producto. SHA-256 de JDK y ZIP command-line verificados antes de extraer; Gradle 9.3.1-all comprobado contra el checksum oficial y fijado en el wrapper. Fuentes: [Adoptium](https://adoptium.net/temurin/releases?version=21), [Android tools](https://developer.android.com/studio), [Gradle checksum](https://services.gradle.org/distributions/gradle-9.3.1-all.zip.sha256). SDK/NDK no se describen como software íntegramente open source. Sin Android Studio, emulador, Google Play ni suscripción.

02/10 — Flutter añade timezone 0.11.1 (BSD-2-Clause, LICENSE inspeccionada en el paquete descargado), fijado en pubspec.yaml/lock. Proporciona IANA y TZDateTime; se carga latest_all desde la biblioteca incluida, sin consulta remota en ejecución ni cuentas. La documentación del paquete identifica la base como 2025c: las reglas legales de zona pueden cambiar; actualizar y contrastar cliente/Intl del servidor al actualizar tzdb. No se descarga una actualización en runtime ni se afirma igualdad global de versiones. Inicialización local perezosa única. Fuente primaria: https://pub.dev/packages/timezone. No servicio de pago ni trial/créditos/tarjeta; no cambia proveedores.
