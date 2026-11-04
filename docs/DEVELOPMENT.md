# Desarrollo local

30/09 — `db:verify-bootstrap` ya comprobó las once migraciones vigentes desde cero y seed repetido. Además de recuentos, prueba owner/worker reales, borrador oculto, historial de Confirmation pendiente y aviso con acuse. La base de desarrollo no se usa para estos datos de prueba; sólo se elimina la fixture creada por el comando.

Seguir primero README. Mantener Node/pnpm y locks del repositorio; no actualizar dependencias en bloque sin motivo.

El build web comprueba `public/session-coordinator.js` con TypeScript y prepara `public` y `.next/static` dentro del standalone. No modificar la copia generada. Tras cambiar el coordinador, cerrar y reabrir todas las pestañas existentes de Nodra para usar el script nuevo. La coordinación depende de SharedWorker; consultar el alcance y fallback en [WEB_APP](WEB_APP.md).

## Base y servicios

Compose normal: postgres en 5432, Valkey en 6379 y Mailpit SMTP 1025/UI 8025. Perfil test añade postgres-test en 5433. `docker compose ps` y `docker compose logs` permiten revisar health/arranque. El 30/09 los cuatro contenedores estaban activos y healthy; hay once migraciones y `db:verify-bootstrap` comprobó el seed repetido en una base temporal separada. postgres-test usa tmpfs: después de recrearlo, aplicar `pnpm db:migrate:test` antes de integrar. No arrancar postgres-test y el fixture local simultáneamente en 5433.

Alternativa usada en Windows sin Docker: node infrastructure/scripts/local-postgres.mjs. Arranca PostgreSQL persistente en .local/postgres, 127.0.0.1:5433 y crea nodra/nodra_test. Usa embedded-postgres como fixture de desarrollo. No arrancar simultáneamente con postgres-test de Compose en el mismo puerto.

Para probar SMTP local sin Docker, ejecutar `powershell -ExecutionPolicy Bypass -File infrastructure/scripts/local-mailpit.ps1`. El script descarga una versión fijada de Mailpit desde su release oficial, verifica SHA-256 del ZIP y del ejecutable y usa `.local/mailpit` para el binario y la bandeja. SMTP escucha sólo en `127.0.0.1:1025` y la UI en `127.0.0.1:8025`; mantener la terminal abierta. No arrancarlo a la vez que Mailpit de Compose en esos puertos.

Para esta alternativa configurar DATABASE_URL a postgresql://nodra:nodra_local@localhost:5433/nodra y TEST_DATABASE_URL al mismo host/puerto con nodra_test. Mantener el proceso abierto y detener con Ctrl+C. No borrar .local/postgres para resolver fallos: contiene datos locales.

Prisma toma la conexión desde prisma.config.ts. db:generate actualiza cliente; db:dev crea migraciones durante desarrollo; db:migrate aplica existentes sin reset. Para test usar pnpm db:migrate:test: carga TEST_DATABASE_URL, exige PostgreSQL local y la base exacta nodra_test, rechaza parámetros de conexión y NODE_ENV=production y pasa la conexión sólo al subproceso Prisma, sin modificar la terminal. db:seed usa explícitamente el tsconfig de API por sus decoradores. db:studio abre inspección local.

Tras compilar la API, `pnpm db:verify-bootstrap` comprueba migraciones, seed repetible y rutas principales en una base PostgreSQL local nueva y aislada. Acepta `DATABASE_URL` hacia `nodra`, `nodra_test` o `postgres` en localhost/127.0.0.1, siempre que el usuario pueda crear bases. El script rechaza conexiones remotas y `NODE_ENV=production`, y elimina únicamente la base temporal que acaba de crear. No sustituye la validación de Compose, Valkey ni Mailpit.

## Storage opcional

docker compose --profile storage up -d minio prepara el fixture S3 opcional, API 9000 y consola 9001. Se construyó desde el Dockerfile fijado y alcanzó healthy; `/minio/health/live` respondió 200. No es parte del arranque obligatorio ni hay uploads generales implementados. Por defecto la foto de perfil usa `ObjectStorageProvider` local en `.local/avatars` (`STORAGE_PROVIDER=local`); `LOCAL_OBJECT_STORAGE_ROOT` puede apuntar a un directorio persistente y privado. Para probar el adapter S3 local, crear el bucket `nodra` en la consola MinIO (http://127.0.0.1:9001), poner `STORAGE_PROVIDER=s3` y descomentar `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` y `S3_BUCKET` en `.env`. Reiniciar la API. El endpoint S3 debe ser HTTP(S) sin ruta ni credenciales embebidas; en producción se exige HTTPS. `@aws-sdk/client-s3` sólo habla con MinIO local en esta configuración, sin cuenta AWS. `infrastructure/docker/Minio.Dockerfile` advierte del upstream archivado: esta prueba no lo convierte en proveedor productivo. Seleccionar una alternativa mantenida cuando entre el módulo de documentos.

## Iteración

Reset opcional sólo de una base local de pruebas desechable, nunca desarrollo. El siguiente comando PowerShell rechaza otros nombres/hosts y no modifica la variable de la terminal; el subproceso usa exclusivamente TEST_DATABASE_URL. **Elimina todos los datos de nodra_test y reaplica migraciones**. No ejecutarlo mientras haya tests concurrentes ni usarlo para reparar una base con datos a conservar. Prisma 7 no ejecuta el seed automáticamente tras reset; el seed demo se ejecuta sólo en la base de desarrollo por el procedimiento README.

```powershell
node --env-file=.env --input-type=module -e 'import {testDatabaseUrl} from "./infrastructure/scripts/test-database.mjs"; import {execFileSync} from "node:child_process"; import {createRequire} from "node:module"; import {dirname,resolve} from "node:path"; const url=testDatabaseUrl(process.env.TEST_DATABASE_URL); const require=createRequire(import.meta.url); const cli=resolve(dirname(require.resolve("prisma/package.json")),"build/index.js"); execFileSync(process.execPath,[cli,"migrate","reset","--force"],{env:{...process.env,DATABASE_URL:url},stdio:"inherit"});'
```

pnpm --filter @nodra/api dev, @nodra/worker dev y @nodra/web dev en terminales separadas. pnpm dev ejecuta los procesos en paralelo pero sus logs se mezclan. API/worker cargan .env desde cwd o raíz. Web usa API_INTERNAL_URL con fallback local.

El worker usa la cola `nodra-notifications` de Valkey. Para una prueba aislada puede definir `NOTIFICATION_QUEUE_NAME` con un nombre diferente tanto en el worker como en su comando `retry`; no cambiarlo sólo en uno de ellos, porque ambos deben consultar la misma cola. La integración de recuperación de proceso genera un nombre temporal propio.

El worker sirve `http://127.0.0.1:4100/health` y `/health/ready`, exclusivamente en loopback. `WORKER_HEALTH_PORT` cambia ese puerto (0 asigna uno efímero para tests, registrado como healthPort al arrancar). Health indica vida del proceso; readiness comprueba PostgreSQL con SELECT 1, comandos de lectura de la cola en las conexiones Valkey del productor/consumidor y que el consumidor esté ejecutándose y no pausado. Responde 503 al fallar o superar 1500 ms, sin divulgar detalles internos. Las consultas simultáneas comparten la sonda pendiente; un driver bloqueado no genera una nueva consulta por petición. No garantiza SMTP ni entrega de todos los jobs: comprobar estados de entrega y Mailpit por separado. No publicar este puerto en LAN.

pnpm lint, pnpm typecheck, pnpm test y pnpm build antes de cerrar cambios. pnpm format formatea apps/packages/docs. Flutter requiere sus propios analyze/test. Ver TESTING.md.

`pnpm db:verify-restore` ensaya dump cifrado y restauración con datos sintéticos en dos bases temporales, objetos y cola aislados. Requiere builds API/worker, PostgreSQL Compose en 5432 y Valkey en 6379. No respalda datos de desarrollo ni conserva una clave de recuperación. El alcance y límites están en [DEPLOYMENT.md](DEPLOYMENT.md); su informe se guarda en `.local/restore/<id>/report.json`.

Para depurar: /health/ready comprueba DB, /docs muestra endpoints, Mailpit muestra correo capturado, logs worker indican fallos de cola sin exponer tokens. Si un proceso pierde su handle, comprobar puertos/procesos antes de reiniciarlo; no lanzar duplicados.

Leer PROJECT_STATE y NEXT_TODOS al comenzar, actualizar ambos al terminar. No marcar DONE sin implementación, verificación y documentación.

## Fotos de perfil locales

La foto propia se guarda en `.local/avatars` por defecto, fuera de Git, sin servicios comerciales. En un despliegue real la carpeta debe ser persistente y privada; si se selecciona S3, debe existir el bucket y contar con permisos privados de lectura/escritura/borrado. El cliente recorta a JPEG cuadrado antes del envío. La API sirve la foto propia a la persona autenticada y la de otro participante sólo con permiso de operación en la misma organización.

## Vista previa en otros dispositivos de la red local

La web de desarrollo escucha en el puerto 3000 de todas las interfaces; la API sigue ligada a 127.0.0.1:4000 por defecto y el BFF la consulta internamente. Definir `NODRA_LAN_HOST` con la IP local del equipo antes de iniciar `pnpm --filter @nodra/web dev --hostname 0.0.0.0`; Next.js usa ese valor para permitir sus recursos de desarrollo desde la IP. Abrir `http://<IP-local>:3000/` en otro dispositivo de la misma red. El BFF comprueba el encabezado Origin frente al Host y protocolo de la petición, también cuando se usa una IP local, sin aceptar orígenes ajenos. Para Flutter Android físico en debug, `API_BIND_HOST=0.0.0.0` permite también el puerto 4000; abrirlo sólo a la subred privada y usar `API_URL=http://<IP-local>:4000/api/v1`. El servidor mantiene el bind a loopback cuando esa variable no se activa.

En este equipo la IP local observada fue 192.168.1.133, pero puede cambiar. El firewall de Windows estaba en perfil Público y crear reglas sin privilegios de administrador devolvió «requiere elevación». Si otro dispositivo no conecta, configurar la red de confianza como Privada y crear desde una terminal elevada reglas restringidas a la subred local: puerto 3000 para la web y, sólo mientras se prueba Flutter Android debug, puerto 4000 para la API. No desactivar el firewall. No se ha verificado una conexión desde un segundo dispositivo.

En este equipo, el comando pendiente de administrador para la API es `netsh advfirewall firewall add rule name="Nodra API Dev LAN" dir=in action=allow protocol=TCP localip=192.168.1.133 localport=4000 remoteip=192.168.1.0/24 profile=any`. Cambiar IP/subred si la red cambia y eliminar esa regla tras la prueba con `netsh advfirewall firewall delete rule name="Nodra API Dev LAN"`. La API ya respondió 200 en su IP LAN desde el mismo host; la regla no se pudo crear desde esta sesión sin elevación y el teléfono aún no se ha probado.

## Compilación Android local en Windows

Los scripts prepare-android.ps1 y build-android.ps1 guardan herramientas/cachés dentro de .local/android-toolchain, fuera de Git. Requieren PowerShell 7 y red para descargar dependencias oficiales. prepare-android fija Temurin JDK 21.0.12.1+1 y Android command-line tools 15859902, verifica SHA-256 antes de extraer y no modifica Java/PATH globales. Instala platform-tools, plataformas 35 (plugins) y 36 (app), build-tools 36.0.0, NDK 28.2.13676358 y CMake 3.22.1, acordes al Flutter del repositorio. Platform-tools usa la revisión disponible del repositorio SDK; la versión observada el 02/10 fue 37.0.1.

```powershell
# Revisa los términos del SDK antes de optar por su aceptación:
# https://developer.android.com/studio
./infrastructure/scripts/prepare-android.ps1 -AcceptSdkLicenses
./infrastructure/scripts/build-android.ps1 -ApiUrl "http://192.168.1.133:4000/api/v1"
```

Sin -AcceptSdkLicenses se preparan únicamente los archivos de herramientas y se muestran las instrucciones; los paquetes del SDK no se instalan. El flag acepta las licencias solicitadas sólo para los paquetes necesarios. build-android comprueba herramientas, usa Flutter local y genera APK debug; caches Gradle y Android/debug keystore quedan en el directorio local. Gradle 9.3.1 tiene SHA-256 fijado en el wrapper. La API debe escuchar en LAN para teléfono físico; el valor predeterminado del script apunta a 10.0.2.2 para emulador. Este comando no publica ni firma una distribución productiva. Ver TESTING para resultados reales, no inferir build válido por la existencia de los scripts.

## Instalación limpia comprobada

[Validación del 02/11](validation/2026-11-02-clean-install.md): copia aislada, pnpm 11.19.0, store vacío, generación, lint/tipos/tests/builds y bootstrap HTTP aprobados. No exportar NODE_ENV=development antes de pnpm build: dejar que Next elija su entorno de compilación. El desarrollo conserva el valor de .env. El informe diferencia esta comprobación de la validación física móvil y productiva.

Logos privados: el provider local conserva los archivos en `organizations/<org>/logos/` bajo `LOCAL_OBJECT_STORAGE_ROOT` (por defecto `.local`). Aplicar la migración 13 con `pnpm db:migrate` antes de arrancar la API actualizada. Desde Perfil → Configuración, OWNER/ADMIN puede subir con recorte o quitar el logo; no acepta URLs externas. El mismo contrato funciona con el adapter S3 opcional, sin habilitarlo por defecto.

## Incidente Docker en Windows, 04/11/2026

Docker Desktop 4.91.0 falló al renombrar sailor-ingest.sock. Se siguió la recuperación por conservación de directorios de IPC descrita en el [reporte de Docker](https://github.com/docker/desktop-feedback/issues/554). Antes de renombrar se comprobó que Docker estaba completamente detenido, que las rutas eran directorios ordinarios y que sólo contenían endpoints de cero bytes. Docker/run y docker-secrets-engine se conservaron con sufijo .nodra-recovery-20261104-224814; sus reemplazos vacíos permitieron arrancar Engine 29.8.0. El registro exacto está en .local/docker-runtime-recovery.json del equipo, excluido de Git. No se borraron backups de sockets, configuraciones, volúmenes ni discos WSL, ni se hizo factory reset.

Esto es evidencia de recuperación en este equipo, no una reparación permanente ni una receta aplicable a directorios arbitrarios. Si reaparece, inspeccionar primero los logs y los procesos y preservar cualquier dato antes de actuar. Servicios y migraciones se revalidaron; no se cambió la versión de Docker.
