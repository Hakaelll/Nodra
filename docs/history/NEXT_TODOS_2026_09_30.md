# Plan de implementación

30/09 — Docker vuelto a comprobar: los cuatro contenedores están healthy; web LAN :3000 devuelve 200 y API /health y /health/ready devuelven 200 con database up. Pasan las ocho regresiones del DELETE sin cuerpo de cliente/BFF. No se reiniciaron procesos ya activos ni cambió runtime. Continúa pendiente NOD-020 §136–290 y la entrega nativa; conservar estados e historial DONE.

30/09 — NOD-020/§106–135: auditoría individual de 30 secciones añadida. OBSERVABILITY prepara OpenTelemetry no-op/local con allowlist, señales, privacidad y gates; no hay SDK/exporter conectado. OTEL_ENABLED no se consumía: comentado como reserva en .env.example. DEPLOYMENT completa las ocho etapas de escalado y persistencia actual de avatares, sin contratar ni desplegar infraestructura. Distinguidas CI configurada/no remota probada y tests HTTP/no DOM de componentes. Formato, 30 IDs y enlaces locales comprobados; .env sigue ignorado. No se repiten suites por documentos y un comentario de ejemplo, sin cambios de runtime. Continuar §136–168/290; NOD-020 activo, builds nativos/E2E/componentes web pendientes, conservar IDs e historial DONE.

30/09 — NOD-017/§105: añadidas cinco regresiones session_network_test de arranque offline y reintento en SessionGate, conservación de tokens ante refresh sin red/503, rechazo 401 con limpieza y una sola renovación concurrente. Usan API real del cliente con Dio interceptado y FlutterSecureStorage simulado, sin asumir validación de cifrado ni hardware. Pasan Flutter analyze --no-pub y 39 tests completos; prueba concurrente usa barreras deterministas, sin espera temporizada. MOBILE_APP/auditoría §105 actualizados. No cambió código productivo porque estos recorridos ya funcionaban; sin Computer Use ni subagentes. Continuar NOD-020 por §106–290; builds nativos/prueba física pendientes y objetivo activo.

30/09 — NOD-020/§83–105: auditoría individual de 23 secciones y precedencia Stripe/instrucciones posteriores documentadas. §103: detalle web ya no queda en skeleton al fallar carga inicial; mensaje local con reintento/regreso, conservando estilo existente. Contraste calculado sólo para tinta/blanco 17.37, muted/blanco 4.75 y blanco/índigo 6.19; no certificación global. Pasan lint, typecheck web, 35 unitarios y build web; formato/IDs/enlaces del bloque comprobados. Sin Computer Use, subagentes ni aceptación visual. Próximo pendiente concreto §105/NOD-017: tests de conservación/restauración de sesión ante red ausente y refresh fallido; continuar auditoría §106–290. No cerrar objetivo ni estados existentes.

30/09 — NOD-017/§79: Inicio Flutter corregido con WorkerHome y listas independientes de pendientes, avisos por leer y próximos; pagination global backend de cinco elementos, sin ordenar una página de servicios generales. API añade horarios locales al resumen y filtro pendingAcknowledgement previo a count/paginación, limitado al usuario. Acuse/respuesta invalidan providers; Inicio se remonta por organización. Dos pruebas nuevas cubren paginación/acuse y respuesta tardía interorganización; integración de avisos y horarios ampliada. Pasan 34 tests Flutter, analyze, 35 unitarios, 56 integraciones verticales, lint, typecheck web/API y builds contratos/API/worker/web. API reiniciada desde sesión original y LAN health 200, PID 16564. Primer intento de restart por Stop-Process falló y el arranque detectó puerto ocupado; resuelto deteniendo la sesión original antes de arrancar, sin duplicados. Pub automático interrumpido por resolución de red; checks finales --no-pub usan dependencias existentes. Sin Computer Use ni subagentes; hardware/builds nativos/auditoría §83–290 pendientes.

30/09 — NOD-020/§59–82: auditoría individual de 24 secciones añadida y enlazada. CUSTOMIZATION prepara CustomFieldDefinition/Value (nueve tipos, FKs tenant, validación), identidad limitada y cinco presets de datos versionados, sin declarar tablas/API disponibles. SECURITY corrige DeviceToken ya operativo por API. Detectados pendientes concretos: §61 personalización, §63 semántica de audit/edición JobRole, §76 destinatarios, §79 Inicio Flutter con resumen global y §81 carreras de cambio de organización. Comprobados formato, 24 IDs y enlaces locales; no se repitieron suites por cambios sólo documentales. Próximo trabajo funcional NOD-017: sustituir prioridad sobre una página por resumen global de acciones/avisos/próximos. Continuar auditoría §83–290; objetivo activo, conservar historial DONE.

30/09 — §73/NOD-014: edición web de borradores conectada al PATCH existente desde el detalle. Precarga nombre/ubicación/descripción y selector de fechas; conserva instantes originales si no cambia horario y resuelve la ocurrencia DST correcta. Añadidas dos regresiones de precarga horaria y ampliada integración para autorización, tenant, auditoría y bloqueo tras publicación. Pasan 35 unitarios, 55 integraciones verticales, lint global, typecheck web/API y build web. El primer intento de integración agotó el hook durante compilaciones simultáneas; la repetición posterior terminó correctamente. WEB_APP/API actualizados. Sin Computer Use ni subagentes; auditoría §59–290 y entrega nativa siguen pendientes, objetivo activo.

30/09 — Docker confirmado: postgres, postgres-test, Valkey y Mailpit saludables. Web en 0.0.0.0:3000 y API en 0.0.0.0:4000; HTTP LAN 200 en página principal y health/ready. Ocho regresiones cliente/BFF del DELETE sin cuerpo pasan. Sin cambios de implementación, sin Computer Use ni subagentes; auditoría general permanece pendiente.

Continuación 30/09, NOD-020/§30–58: auditoría individual añadida en docs/audit/SECTIONS_030_058.md. DOMAIN_EXTENSIONS especifica Availability y targeting futuro por organización/grupo/rol/servicio/personas con FKs tenant, snapshot de destinatarios, permisos, backfill y pruebas pendientes; no crea tablas/endpoints ni altera difusión actual. Corregido DATA_MODEL (once migraciones, API DeviceToken existente, flags Grupos/Chat) y ROADMAP (Chat ya autorizado, adapter S3 de fotos existente). Se conserva el límite de duplicación SMTP y los horarios por posición aún no disponibles. Formato, cobertura de IDs y enlaces locales comprobados; no se repiten suites de aplicación por cambios sólo documentales. Auditoría §59–290 y builds/dispositivo pendientes; objetivo activo. Próximo NOD-020: §59–82, incluidos requisitos de UI y docs de seguridad; conservar los estados e historial DONE.

30/09 — Tras recuperar Docker y aplicar once migraciones a postgres-test tmpfs, pasan 57/57 integraciones focalizadas (vertical API, SMTP de cuentas y transporte Valkey/BullMQ/Mailpit) y la prueba de privacidad de ConsolePush. Web/API LAN 200; API PID 23884, web dev y worker PID 22532 activos. Intento Android APK falló por SDK ausente. No se afirma validación visual ni build móvil; auditoría individual §0–29 creada, §30–290 pendientes.

Continuación 30/09, NOD-020: §0–29 auditados individualmente con límites explícitos. Continuar por §30–58 y no confundir funciones futuras documentadas con alcance MVP. Android SDK ausente comprobado por intento de APK. Al reiniciar postgres-test (tmpfs), aplicar db:migrate:test antes de integrar. Conservar estados e historial DONE.

Continuación 30/09, §67–70/287/NOD-020: bootstrap desde PostgreSQL vacío con once migraciones y seed ejecutado dos veces pasó. Verificador ampliado cuenta GroupMember y Confirmation y comprueba por API las features predeterminadas, acceso real owner/worker, borrador oculto para trabajador, Assignment propio pendiente con Confirmation sin respuesta y aviso con acuse requerido. Eliminó su única base efímera. Docker Compose muestra postgres, postgres-test, valkey y mailpit running/healthy. No confirma E2E visual, hardware ni CI remoto; la auditoría integral sigue abierta. Próximo: continuar NOD-020 con auditoría requisito por requisito; conservar los estados existentes.

Continuación 30/09, §60/NOD-022: feature Chat por organización conectado a todas las rutas API y a web/Flutter, modificable sólo por OWNER/ADMIN en settings/features. PATCH parcial conserva otras claves; flag desactivado conserva conversaciones y pendientes. Migración 11 aplicada a desarrollo/test y habilita Chat existente cuando faltaba la clave. Integración cubre diez operaciones bloqueadas, permisos, aislamiento y recuperación; widget comprueba ausencia de solicitudes en Chat desactivado. Pasan 57 integraciones (5 opt-in omitidas), 33 unitarios actuales, lint, typecheck web/API, builds TS del monorepo y Next, Flutter analyze y 32 tests. API reiniciada con estos cambios, PID 2628. Sin Computer Use ni subagentes; catálogo restante, auditoría integral y builds/pruebas en dispositivo pendientes. Se conserva el objetivo y los NOD abiertos; no cerrar §60 completo.

Continuación 30/09, NOD-014/021/022: cabecera compacta, espacio recuperado en todas las pantallas y chat a altura disponible. Menú de tres puntos y borrado por participante en web/Flutter, con reaparición sólo al recibir mensaje nuevo. 10 migraciones en desarrollo/test; 56 integraciones (5 omitidas), 37 unitarios, lint, typecheck, build, analyze y 31 tests Flutter pasan. HTTP web/API comprueba DELETE sin cuerpo por BFF y recuperación con nuevo mensaje; la base temporal se eliminó. Mantener NOD-022 IN_PROGRESS por E2E físico/builds/push y evaluación visual; no se usaron subagentes ni Computer Use.

Corrección 30/09, NOD-014/020: resuelto bloqueo de arranque web LAN cargando .env raíz, admitiendo hostname configurado y aislando .next-dev del build .next. Cliente con timeout de 20 s. Logs reales de sesión y 15 scripts LAN 200; lint, 36 unitarios, typecheck y build web pasan. Sin Computer Use ni subagentes. Retomar feature Chat de §60; todavía no implementado.

Continuación 30/09, NOD-013/§55: API autenticada para alta/renovación, listado paginado y revocación de dispositivos propios, sin tokens en las respuestas. Integración PostgreSQL verifica idempotencia, rotación, paginación, reactivación, rechazo de userId ajeno, revocación cruzada y carrera por token global. Pasan 55 integraciones (5 opt-in omitidas), 35 unitarios, lint, typecheck y build API. Falta adquisición de token en clientes, permisos y push remoto; NOD-013 sigue IN_PROGRESS.

Continuación 30/09, NOD-022: contador de conversaciones pendientes arriba a la izquierda del icono, separado del total de mensajes. Refresco web con foco/visibilidad y aislamiento de respuestas entre usuario/organización. Cliente Flutter implementado y 31 tests aprobados. Lint, typecheck, 35 unitarios, 54 integraciones (5 omitidas), build y analyze pasan. Web/API disponibles por LAN. Siguen pendientes E2E físico, builds nativos y push; conservar IN_PROGRESS y el historial previo.

Continuación 28/09, NOD-022: chat manual y de servicio operativo en web/API con contador persistente de no leídos, lectura al abrir, orden cronológico y compatibilidad con HTTP LAN. Nueve migraciones en desarrollo/test; 54 integraciones, 35 unitarios, lint, typecheck y build pasan. API reiniciada con rutas actuales; web y API responden en 192.168.1.133. Pendientes E2E en dispositivo, posible notificación push de chat y cliente Flutter; mantener IN_PROGRESS. La tolerancia a Membership sin `features` y el reinicio de API corrigen el runtime observado al abrir Grupos.

Continuación 28/09, NOD-018/021 y §60: Avisos móvil conserva fondo blanco hasta el final de la pantalla y las acciones de cabecera tienen etiqueta visible y forma estable, sin reducir el texto a `font-size: 0`. La disponibilidad de Grupos viaja en la Membership y controla la navegación web, incluida entrada directa. 52 integraciones no opt-in, 33 unitarios, lint, typecheck y build pasan. Pendientes aceptación visual en dispositivo, otras funciones del catálogo y auditoría integral del prompt; estados abiertos.

Continuación 28/09, §60/NOD-008: Grupos ahora obedece su feature flag por organización en lectura y escritura. PATCH settings/features queda limitado a OWNER/ADMIN y auditado; integración cubre cinco rutas, aislamiento y reactivación. Pasan 52 integraciones no opt-in, 33 unitarios, lint, typecheck y build. Faltan activación efectiva de las otras funciones del catálogo, contrato de visibilidad para clientes y revisión de aceptación; no cerrar NOD-008 ni §60.

Continuación 28/09, NOD-018/021: tras las capturas del teléfono, cabecera móvil sin nombre de vista duplicado, vacíos más compactos y Avisos vacío como un único mensaje compartido por desktop/móvil. Lint, typecheck, 33 unitarios, build web y detector estático pasan. El propietario valorará la composición en el teléfono.

Continuación 28/09, NOD-021: nueva composición móvil web sin tarjetas anidadas en las vistas principales, con jerarquía por espacio y divisores. Lint, typecheck, 33 unitarios, build web y detector de diseño pasan. Pendiente aceptación visual y prueba en teléfono por el propietario, sin Computer Use.

Continuación 28/09, NOD-007/011/014/020: recorrido HTTP completo por BFF/API/DB aprobado mediante `pnpm test:web-vertical` en una base PostgreSQL efímera: registro de dos sesiones, invitación por código, publicación, inscripción, selección y confirmación persistida. La base se eliminó. Quedan pruebas de controles visuales a cargo del propietario, E2E desde dispositivo y auditoría del prompt completo; no cerrar NOD-020.

Continuación 28/09, NOD-014/020: pruebas directas del BFF Next cubren cookies HttpOnly y ocultación de tokens en registro/refresh, CSRF por Origin, subida JPEG y GET binario privado. Lint, typecheck, 33 unitarios y build pasan. Falta un recorrido web completo con API/DB reales y la valoración visual del propietario; NOD-014/020 siguen IN_PROGRESS.

Continuación 28/09, NOD-007/017/020: añadidas pruebas widget Flutter de aceptar código tras preview y seleccionar nueva organización, de inscribirse en posición y de confirmar asignación con estado actualizado. Pasan analyze y 27/27 tests. `flutter doctor` detecta Flutter local, pero no Android SDK; iOS requiere macOS/Xcode. Falta build nativo y recorrido contra backend desde dispositivo, así que los estados REVIEW/IN_PROGRESS se conservan.

Continuación 28/09, §54/57/NOD-013: `NotificationDelivery` persiste entrega e intentos por PUSH/EMAIL; la prueba PostgreSQL demuestra que un fallo de correo no reenvía push ya confirmado. Migración aplicada a desarrollo/test y bootstrap de siete migraciones verificado. Pasan 54 integraciones con transporte Valkey/Mailpit (2 opt-in omitidas), 28 unitarios, lint, typecheck y build. Quedan push real, registro protegido de dispositivos y límites de entrega al menos una vez; NOD-013 sigue IN_PROGRESS.

Continuación 28/09, §55/NOD-013: `DeviceToken` preparado con migración aplicada a desarrollo/prueba, plataformas, relación global con User, unicidad y revocación. Una integración PostgreSQL comprueba dos dispositivos de una persona y el aislamiento del identificador de instalación entre usuarios. `db:verify-bootstrap` pasó con seis migraciones; 51 integraciones locales (5 opt-in omitidas), 28 unitarios, lint, typecheck y build pasaron. Pendientes: almacenamiento protegido, API de alta/baja, Delivery por canal y proveedor push sólo tras decisión de infraestructura; NOD-013 continúa IN_PROGRESS.

Continuación 28/09, NOD-007/021: Flutter ofrece emisión de código en Perfil para OWNER/ADMIN y alta por código desde cualquier perfil, además del onboarding. El código sólo se muestra tras crearlo; copiar y revocar están disponibles. Entrada numérica de 12 cifras con validación local y confirmación del nombre de organización antes de aceptar. `flutter analyze --no-pub` y 24/24 tests móviles pasan; pendiente comprobar el flujo completo en dispositivo, por lo que NOD-007 sigue REVIEW. La revisión visual queda al propietario; sin Computer Use.

Continuación 28/09, NOD-007/013: OWNER/ADMIN emiten un código numérico de 12 cifras junto al enlace de la misma invitación; ambas credenciales comparten caducidad, revocación y usos atómicos. Migración aditiva `codeHash` aplicada a bases local y de prueba. La suite integrada pasó 55/55, incluida parada/reinicio de un Valkey aislado y entrega posterior por el worker. Siguen pendientes E2E de clientes y canales futuros; no cambiar REVIEW/IN_PROGRESS a DONE. Flutter SDK no estuvo disponible en PATH para comprobar el texto móvil. Sin Computer Use.

Continuación 27/09, NOD-021: tarjetas de formulario ensanchadas al ancho de la sección tras reducir el sidebar; campos interiores limitados por legibilidad. Lint, 28 unitarios y build web pasan. Pendiente aceptación visual del propietario en sus dispositivos, sin Computer Use.

Continuación 27/09, NOD-021: `.content` ya ocupa todo el ancho útil junto al raíl compacto, sin tope global de 1880 px; los límites de lectura particulares se conservan. Lint, typecheck, 28 unitarios, build web y detector estático pasan. Web y asset responden 200 por IP LAN del host; pendiente evaluación visual del propietario y segundo dispositivo, sin Computer Use.

Continuación 27/09, NOD-020/021: raíl de escritorio tipo Codex implementado con iconos accesibles según permiso, organización en cabecera y Perfil al pie; móvil conserva barra inferior y Más. Lint, typecheck, build web y detector estático pasan; web y API responden por IP LAN del host. Falta aceptación visual del propietario y prueba desde segundo dispositivo. §139–141: ACCOUNT_LIFECYCLE.md traza desactivación, anonimización y soft delete futuros contra las FK reales; no se habilitó borrado de cuenta.

Continuación 27/09, NOD-018/021: actividad de servicios añadida a Avisos web/Flutter, separada de mensajes manuales y con cancelados al final antes de paginar. Integración tenant/destinatario/orden, 53 integraciones, 28 unitarios, lint, typecheck, build, Flutter analyze y 21 tests pasan. API y web responden 200 por IP del host 192.168.1.133:4000/3000; falta prueba desde un segundo dispositivo, aceptación visual del propietario, E2E y builds nativos. Estados abiertos conservados, sin Computer Use.

IDs NOD-001 a NOD-020 reservados según docs/BOOTSTRAP_PROMPT.md. No reutilizar ni eliminar tareas completadas.

Continuación 27/09, NOD-011/012/019: carrera HTTP entre dos posiciones del mismo servicio para una persona verificada con una sola selección activa y rechazo 409; tras declinar, la segunda selección funciona y la Confirmation anterior queda histórica. Pasaron 52 integraciones, 28 unitarios, lint, typecheck y build. Ampliar a otras intercalaciones y E2E sin marcar DONE. NOD-018/021: Avisos hoy sólo presenta avisos manuales; integrar actividad de servicios sin duplicar NoticePublished y colocar cancelados al final sigue pendiente frente a la petición del propietario.

Continuación 27/09, NOD-013: la prueba opt-in de recuperación del proceso incluyó desconexión/reconexión de red a Valkey mediante proxy local, evento no procesado durante la interrupción y entrega posterior por el mismo proceso. Pasaron 51 integraciones, 28 unitarios, lint, typecheck y build. El servidor Valkey no se detuvo: probar su caída real y canales futuros sigue abierto.

Continuación 27/09, NOD-013: prueba opt-in de caída/reinicio del proceso worker completo tras un fallo SMTP, con cola temporal; recuperación observada con una Notification y un correo. `NOTIFICATION_QUEUE_NAME` conserva por defecto `nodra-notifications` y también lo usa `retry`. Pasaron 51 integraciones, 28 unitarios, lint, typecheck y build. Falta fallo de Valkey y entrega por canales futuros, sin marcar DONE.

Continuación 27/09, NOD-019: prueba HTTP de los cuatro roles sobre siete operaciones de servicios, avisos, equipo, invitaciones y ajustes, con recuento de escrituras tras 403. Pasaron 50 integraciones, 28 unitarios, lint, typecheck y build. Se corrigió una aserción aleatoria que podía no modificar el token cifrado. Pendiente ampliar la matriz a rutas y transiciones restantes, sin marcar DONE.

Continuación 27/09, NOD-016/020/021 y §138: Flutter añadió ARB español y localización nativa Material/Cupertino; web tiene diccionario tipado para navegación, desacoplado de ruta. Flutter analyze y 21 tests, lint, typecheck y build monorepo pasaron. Pendiente migrar el resto del texto/formatos y añadir traducciones antes de habilitar otro idioma; no marcar i18n completo ni los NOD como DONE. Se mantiene la aceptación visual del propietario y la limitación de builds nativos.

Continuación 27/09, NOD-003/013/016/019/020: 49/49 integraciones opt-in pasaron contra PostgreSQL de prueba, Valkey, Mailpit y MinIO; 28 unitarios, lint, typecheck y build completo también. API de desarrollo admite `API_BIND_HOST=0.0.0.0` explícito para Android físico debug y respondió 200 por IP LAN; por defecto queda en loopback. La web respondió 200 en :3000. La regla de firewall limitada al puerto 4000/subred local no se pudo crear: Windows exige elevación de administrador. Pendientes prueba real en segundo dispositivo, build móvil nativo, fallos del proceso worker y auditoría detallada de las 290 secciones.

Continuación 27/09, NOD-003/016/019/020: prueba S3/MinIO ampliada desde el contrato aislado hasta la ruta real de avatar con registro, upload, GET autenticado y control de acceso 401; bucket y usuario efímeros limpiados. PostgreSQL tmpfs recibió 4 migraciones. Pasaron lint, typecheck, build completo, 28 unitarios y 47 integraciones (2 opt-in omitidas). Pendientes E2E web/móvil, builds nativos, fallos de worker, aceptación visual y auditoría final de 290 secciones.

Entorno 27/09: PostgreSQL principal, Valkey, Mailpit, MinIO y postgres-test healthy; API, worker y web arrancados en segundo plano. API ready y web localhost/LAN dieron 200, BFF sin sesión 401. Para continuar, comprobar procesos/puertos antes de iniciar duplicados. No confundir disponibilidad LAN de la web con acceso directo a la API desde Flutter físico.

Continuación 24/09, NOD-003/020: adapter S3 opcional integrado con MinIO local; configuración segura y prueba con bucket efímero. Filesystem permanece por defecto; no se presupone aptitud productiva del upstream archivado. Pasaron 47 integraciones (2 opt-in omitidas), 28 unitarios, lint, typecheck y build completo. Se revalidaron acuses de lectura por rol y cancelados al final de Servicios, ya implementados; aceptación visual pendiente.

Continuación 24/09, NOD-003: MinIO opcional construyó desde el Dockerfile local, arrancó healthy y su endpoint live respondió 200. PostgreSQL principal, Valkey y Mailpit de Compose también están healthy. No existe adapter S3 ni se adopta el upstream archivado para producción; NOD-003 sigue IN_PROGRESS hasta cerrar conexiones y documentación final.

Continuación 24/09, NOD-002/003/016/019/020: se implementó `ObjectStorageProvider` con proveedor local predeterminado y se conectó a las fotos propias/de participantes. Claves seguras, put atómico y rechazo de MIME malformado tienen 2 unitarios; la integración PostgreSQL de foto/permisos volvió a pasar. Gates: lint, typecheck, 28 unitarios, 46 integraciones base, build completo. S3/MinIO opcional no validado; estados abiertos conservados.

Continuación 24/09, NOD-003/020: PostgreSQL principal de Compose en 5432 arrancó healthy junto con Valkey y Mailpit; cuatro migraciones aplicadas, seed repetido y `db:verify-bootstrap` aprobado con base efímera independiente, login y servicios. El PostgreSQL persistente de 5433 quedó separado. Se retiró la contraseña demo del log del seed. MinIO opcional se comprobó después; el resto de la auditoría final sigue abierto.

Continuación 24/09, NOD-009/016/018/019/021: los acuses de Avisos identifican por nombre a quien confirmó para OWNER/ADMIN/COORDINATOR sin exponer correo ni nombres ajenos a MEMBER; web y Flutter permiten desplegar la lista. Servicios coloca CANCELLED al final antes de paginar y Flutter Inicio conserva ese orden al priorizar pendientes. Integración PostgreSQL de rol/paginación, 46 casos base, 26 unitarios, lint/typecheck/build monorepo, Flutter analyze y 20 tests pasaron. Falta aceptación visual del propietario y E2E de clientes; estados conservados.

Continuación 24/09, NOD-016/020: `apps/mobile/README.md` ya documenta ejecución, estructura, funciones y límites reales; `pubspec.yaml` tiene descripción propia. La API ligada a loopback explica por qué el teléfono físico no puede consumirla con la IP usada para la web por LAN. Se repitieron `flutter analyze --no-pub` sin incidencias y `flutter test --no-pub` con 20 tests aprobados; web, API ready y web por IP LAN respondieron 200. `docs/REQUIREMENTS_AUDIT.md` registra un primer pase de las obligaciones y gates restantes, sin compilación nativa ni inspección de hardware. NOD-020 sigue IN_PROGRESS.

Continuación 24/09, NOD-013: integración Valkey/BullMQ/Mailpit ampliada con fallo de conexión SMTP real, reintento persistido tras reemplazar el consumidor y entrega única cuando el primer intento no había enviado nada. Un fallo inyectado después de aceptar SMTP produjo dos correos con el mismo Message-ID y una sola Notification, confirmando el límite at-least-once documentado. Pasan 47 integraciones, 26 unitarios, lint/typecheck/build worker. Falta ensayar caída/reinicio del proceso completo y fallo de Valkey; estado IN_PROGRESS conservado.

Continuación 24/09, NOD-003/013/017/020/021: servicios cancelados atenuados y etiquetados en web/Flutter, incluidos calendario y detalle; quedan fuera de próximos. Docker Desktop/Compose disponibles: Valkey, Mailpit y postgres-test healthy, cuatro migraciones aplicadas en base de prueba y transporte real Outbox→BullMQ→Notification→SMTP verificado con limpieza. Pasan 47 integraciones, 26 unitarios, lint/typecheck, builds web/worker, Flutter analyze y 20 tests. PostgreSQL persistente, API, web y worker reactivados; web responde por LAN. Pendientes aceptación visual, segundo dispositivo, caída/reintentos reales, builds nativos y auditoría final.

Continuación 24/09, NOD-003/005/019/021: Mailpit v1.31.1 local recibió por SMTP real los enlaces de recuperación y verificación y la API los consumió en una prueba opt-in; la suite sumó 46 integraciones, además de 26 unitarios, lint, typecheck y builds API/worker. NOD-003/019 siguen IN_PROGRESS hasta Valkey/BullMQ y Compose reales. El escritorio escala ya desde 1280 px CSS para incluir 2K con escalado de Windows, con controles y metadatos mayores y lienzo amplio; falta aceptación visual del propietario, sin Computer Use.

Continuación 24/09, NOD-005/016: la verificación de correo puede completarse en Flutter desde Perfil pegando el enlace `#verify=`; el perfil recarga el estado real. Analyze y 20 tests pasan, con cobertura de fragmento correcto, rechazo cruzado, validación, envío único y acceso a la hoja. Quedan pendientes SMTP/Mailpit y dispositivo/deep link reales; sin Computer Use.

Continuación 24/09, NOD-005/016: Flutter consume un token de recuperación pegado desde el enlace recibido, con validación local de enlace/contraseñas y confirmación del resultado. Analyze y 17 tests pasan. Pendiente probar correo→dispositivo, build nativo, SMTP real y consumo de verificación dentro de Flutter; no se usó Computer Use.

Continuación 24/09, NOD-008: GET groups ya devuelve items/total/page/limit con orden estable por nombre/id y recuento limitado al acceso de MEMBER; la web recorre páginas de 25. La integración PostgreSQL comprueba 101 grupos y visibilidad de un solo grupo para MEMBER. Pasan lint, typecheck, 26 unitarios, 45 integraciones y build; endpoint local actualizado. Continúan pendientes E2E del flujo y validación visual del propietario, sin Computer Use.

Continuación 24/09, NOD-021: adaptación del escritorio ancho a resoluciones 2K mediante ancho de trabajo y escala tipográfica/espacial acotados. Pasan lint, typecheck, 26 unitarios y build; web disponible de nuevo por LAN. La aceptación visual del propietario sigue pendiente. Se conservan los IDs y estados abiertos, sin Computer Use.

Continuación 24/09, NOD-016/017/021: Perfil Flutter ahora edita nombre/apellidos y foto de galería; hoja circular con arrastre/zoom exporta JPEG 512 px antes de subirlo. Se añadió permiso descriptivo iOS, recuperación de selección interrumpida y selector de organización sólo con varias Memberships. Dependencias gratuitas `image_picker` e `image` fijadas en lock. `flutter analyze --no-pub` y 13 tests pasan. Pendientes: build nativo, prueba en dispositivo y aceptación visual; estados REVIEW/IN_PROGRESS conservados. No se usó Computer Use.

Continuación 24/09, NOD-010/012/021: la API ya impide retirar interés mientras haya asignación activa; la integración cubre selección pendiente, confirmación y retirada tras cancelación. La web en LAN necesitaba `allowedDevOrigins`: Next.js bloqueaba `/_next/hmr` desde 192.168.1.133 aunque HTML, JS, CSS y BFF respondían. Se añadió `NODRA_LAN_HOST` y se reactivaron PostgreSQL/API/web. Pasan lint, typecheck, build, 26 unitarios y 44 integraciones; la comprobación real desde un segundo dispositivo sigue a cargo del propietario. No se usó Computer Use.

Continuación 23/09, NOD-011/014/015/017/019/021: lista/detalle de servicios localizados en API, inscripción y estado propio visibles en web/Flutter, avatar de participantes con autorización de tenant, tarjeta de servicio pulsable, estados sin cápsulas y calendario con color por evento. El BFF admite la IP de la LAN con Origin estricto; web escucha en 0.0.0.0:3000. PostgreSQL se conecta en UTC y el test comprueba epoch en un salto DST. Gates: 44 integraciones, 26 unitarios, 10 Flutter, lint/typecheck/build/analyze. Pendientes: aceptación visual, prueba real desde otro dispositivo (regla de firewall requiere administrador), E2E, Valkey/Mailpit y builds nativos; sin Computer Use.

Continuación 23/09, errores de transporte: NOD-005/021 normalizan respuestas vacías o mal formadas en web y Flutter para dar mensajes útiles; 429, sesión caducada y falta de conexión se distinguen. La subida de foto web usa la misma lectura segura. Pasan lint, typecheck, build, 24 unitarios, Flutter analyze y 8 tests. Permanecen pendientes la aceptación visual, E2E e infraestructura real.

Continuación 23/09, ajuste de horarios y errores: NOD-015/017/021 interpretan las fechas del servicio en la zona IANA de la organización, con aviso ante la hora inexistente y elección explícita de primera/segunda ocurrencia cuando se repite. Los avisos de error web y los mensajes puntuales de Flutter comparten una superficie cálida contenida, iconografía y texto legible. Pasan lint, typecheck, build monorepo, 21 unitarios, Flutter analyze y 7 tests; aceptación visual y E2E siguen pendientes a cargo del propietario, sin Computer Use.

Continuación 23/09: NOD-015/017/021 avanzan con calendario Flutter mensual y horarios de la organización, selector de fechas/horas propio al crear servicio web, errores coherentes junto a campos y diálogos centrales para las acciones sensibles. API mensual devuelve hoy y fechas/horas locales; 44 integraciones PostgreSQL, 19 unitarios, lint, typecheck, build, Flutter analyze y 7 tests pasan. El propietario mantiene la revisión visual sin Computer Use. Permanecen pendientes E2E, Valkey/Mailpit reales, builds nativos y auditoría final; estados abiertos sin alterar.

Revisión 23/09 posterior: NOD-014/015/021 incorporan calendario mensual con horarios y servicios próximos, campana para Avisos, validación visual propia y confirmación de cierre de sesión. Flutter solicita recuperación/verificación y confirma logout; consumir los enlaces sigue en web. Endpoint mensual y cruce de meses probados en PostgreSQL. Gates: lint, typecheck, build, 17 unitarios, 44 integraciones, Flutter analyze y 6 tests. Pendientes de aceptación visual del propietario, prueba E2E, SMTP real y builds nativos; no se usó Computer Use.

Revisión 23/09: acabado web de botones/campos/navegación refinado sin cambiar destinos ni flujos. Recuperación/verificación de email implementadas en API/web/outbox/worker con pruebas PostgreSQL y proveedor falso (44 integraciones); NOD-005 continúa REVIEW hasta verificar SMTP real y clientes. Gates actuales: lint, typecheck, 17 unitarios, 44 integraciones y build pasan. API/web disponibles en localhost:4000/3000; no se usó Computer Use.

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
